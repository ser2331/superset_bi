import React from "react";
import ReactDOM from "react-dom";
import d3 from "d3";
import contextmenu from "d3-context-menu";
import dt from "datatables.net-bs";
import "datatables.net-bs/css/dataTables.bootstrap.css";
import $ from "jquery";
import _ from "lodash";

import { t } from "../javascripts/locales";
import { d3format } from "../javascripts/modules/utils";
import "./pivot_table.css";

import Pagination from "../javascripts/components/Pagination";
import { Hierarchy } from "../utils/hierarchy";
import { contextMenuEnabled } from "../utils/context_menu";
import { renderLegend } from "./table";
import { tablePivotDDVisualization } from "./helpers/ddVisualization/tablePivotDDVisualization";
import { checkMetric } from "./helpers/ddVisualization/helpers/checkDDShowMenu";

import "d3-context-menu/css/d3-context-menu.css";
import { tablePivotFormatterCombineMetric } from "./helpers/ddVisualization/helpers/tablePivotFormatter";

contextmenu(d3);

dt(window, $);
const regExpQuot = /&quot;/g;
const regExpPlug = /hasQuot/g;

const hasQuot = 'hasQuot';
const quot = '"';
/**
 * @param {HTMLTableCellElement} target Context menu event target
 * @returns {number} Clicked <td> cell index relatively to other cells in the row
 */
function normalizeCellIndex(target) {
  let cellIndex = null;
  const array =
    target.tagName.toLowerCase() === "td"
      ? $(target)
          .parent("tr")
          .find("td")
          .toArray()
      : $(target)
          .parent("tr")
          .find("th")
          .toArray()
          .filter((item) => !item.dataset.column);
  array.find((cell, index) => {
    if (cell === target) {
      cellIndex = index;
      return true;
    }
    return false;
  });
  return cellIndex;
}

/**
 * @param {HTMLTableCellElement} target Context menu event target
 * @param {string} series Series (column) name
 * @returns {array} Cells with values of specified series
 */
function normalizeSeriesCells(target, series, verboseName) {
  const seriesCells = $(target)
    .closest("table")
    .find(`th[data-series="${series}"]`);
  const seriesHeader = seriesCells.filter(`:contains("${verboseName}"), :contains("${series}")`);
  const normalizedSeries = [];
  seriesCells
    .toArray()
    .filter((_, index) => index > seriesHeader.index())
    .forEach((column) => {
      const colspan = column.attributes.colspan ? Number.parseInt(column.attributes.colspan.value, 10) : 1;
      for (let i = 0; i < colspan; i++) {
        normalizedSeries.push(column);
      }
    });
  return normalizedSeries;
}

export const getMaxValuePivotTabe = (tableHtml) => {
  const values = [];

  $(tableHtml)
    .find("tbody tr")
    .filter(
      (a, b) =>
        $(b)
          .find("th")
          .text() !== "‹All›"
    )
    .find("td")
    .each((i, elem) => {
      values.push(Number($(elem).text()));
    });

  return values.length ? Math.max(...values) : 1;
};

const getContrastColor = ({ r, g, b }) =>
  r * 0.299 + g * 0.587 + b * 0.114 > 186 ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";

export default function(slice, payload) {
  const allIdsHierarchy = new Set(payload?.hierarchy?.flatMap?.((h) => h.columns.map((column) => column.id)) ?? []);
  const getVerboseName = (columnName) => {
    const matchingColumn = slice.columns.find((item) => item.column_name === columnName);
    if (matchingColumn) {
      return (matchingColumn.verbose_name || columnName).trim();
    }
    const matchingMetric = slice.metrics.find((item) => item.metric_name === columnName);
    if (matchingMetric) {
      return (matchingMetric.verbose_name || columnName).trim();
    }
    return columnName.trim();
  };

  const getColumnName = (verboseName) => {
    const matchingColumn = slice.columns.find((item) => item.verbose_name === verboseName);
    if (matchingColumn) {
      return (matchingColumn.column_name || verboseName).trim();
    }
    const matchingMetric = slice.metrics.find((item) => item.verbose_name === verboseName);
    if (matchingMetric) {
      return (matchingMetric.metric_name || verboseName).trim();
    }
    return verboseName.trim();
  };
  const container = slice.container;
  const fd = slice.formData;
  const height = container.height();
  let cols = payload.data.columns;
  if (Array.isArray(cols[0])) {
    cols = cols.map((col) => col[0]);
  }

  // payload data is a string of html with a single table element
  payload.data.html = payload.data.html.replaceAll(regExpQuot, hasQuot)

  container.html(payload.data.html);

  const { formData } = slice;
  let {
    conditional_formatting: conditionalFormatting,
    show_legend: showLegend,
    conditional_formatting_percentage: percentageRange,
  } = formData || {};

  const checkRange = (to, from, value) => value >= from && value <= to;

  conditionalFormatting.forEach(({ from, to, color }) => {
    const max = getMaxValuePivotTabe(payload.data.html);
    const toCheckParcent = percentageRange ? (max * to) / 100 : to;
    const fromCheckParcent = percentageRange ? (max * from) / 100 : from;

    container
      .find("tbody tr")
      .filter(
        (a, b) =>
          $(b)
            .find("th")
            .text() !== "‹All›"
      )
      .find("td")
      .each((i, elem) => {
        const cell = $(elem);
        const valueCell = $(elem).text();
        if (
          checkRange(parseFloat(toCheckParcent), parseFloat(fromCheckParcent), Number(valueCell)) &&
          valueCell !== ""
        ) {
          cell
            .css("background", `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`)
            .css("color", getContrastColor(color));
        }
      });
  });

  // jQuery hack to set verbose names in headers
  const replaceCell = function() {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = slice.datasource.verbose_map[s] || s;
  };
  slice.container.find("thead tr:first th").each(replaceCell);
  slice.container.find("thead tr th:first-child").each(replaceCell);

  const replacedMetricsName = {
    "COUNT(*)": "count",
  };

  const getFullNameMetricThenCombine = checkMetric(slice, payload);

  // jQuery hack to format number
  slice.container.find("tbody tr").each(function() {
    $(this)
      .find("td")
      .each(function(i) {
        const metricFullName = slice.formData?.combine_metric
          ? getFullNameMetricThenCombine(i)
          : $(this).attr("data-column");

        const format = tablePivotFormatterCombineMetric(slice, payload, i, replacedMetricsName, metricFullName);

        const tdText = $(this)[0].textContent;

        if (!isNaN(tdText) && tdText !== "") {
          $(this)[0].textContent = d3format(format, tdText);
        }
      });
  });

  // jQuery hack to format number Remove data attr in thead nulled cell
  slice.container.find("thead tr").each(function(index, tr) {
    const cell = $(tr).find("th");
    let currentIndex = 0;
    let rmAttr = !cell[currentIndex].innerText.length;
    while (rmAttr && cell.length > currentIndex + 1) {
      $(cell[currentIndex]).attr("data-not-data", "true");
      rmAttr = !cell[++currentIndex].innerText.length;
    }
  });
  container.css("overflow", "auto");
  container.css("height", `${height + 10}px`);

  // собираем дерево значений колонок чтоб отсюда брать фильтра при переходе DD из ячеек total
  //
  const columnTree = [];
  const rows = slice.container
    .find("table thead tr:not(:eq(-1))")
    .get()
    .reverse();
  rows.forEach((row) => {
    const verboseColumnName = $(row)
      .find("[data-column]")
      .not('[data-not-data="true"]');
    if (verboseColumnName.length) {
      const values = [];
      verboseColumnName.nextAll("th").each((thIndex, th) => {
        let colspan = parseInt($(th).attr("colspan"), 10) || 1;
        const value = {
          value: $(th).text(),
          isValue: !($(th).data("total") || $(th).data("subtotal")),
        };
        Array.from({ length: colspan }).forEach((_) => {
          values.push(value);
        });
      });
      columnTree.push({
        columnName: verboseColumnName.text(),
        values: [].concat(values),
      });
    }
  });
  //
  //
  // TODO: порефакторить
  const menu = (data) => {
    /* TODO: Вынести в функцию */
    const targetCell = $(data.target);
    const targetCellIsThead = targetCell.prop("tagName").toLowerCase() === "th";
    const targetCellInTableThead = !!targetCell.closest("thead").length;
    let columnName = "";
    if (targetCellInTableThead) {
      columnName = $(data.target).data("series") || $(data.target).data("column");
    } else if (!slice.formData.combine_metric) {
      columnName = $(data.target).data("column");
    } else {
      const eventValueIndex = normalizeCellIndex(data.target);
      columnName =
        $(data.target)
          .closest("table")
          .find("thead tr:eq(-2) th:not([data-not-data]):eq(" + eventValueIndex + ")")
          .text() || $(data.target).data("column");
    }

    let columnVerboseName = null;
    const columnValue = $(data.target).text();

    if (!columnValue) return false;
    // вспомогательные функции
    // data-total - столбец <Всего>
    // data-subtotal - Стока <Итого>
    // data-total-row - Итоговая строка <Всего> таблицы
    const isSubtotalCell = (cell) => $(cell).data("subtotal") === true;
    const isTotalCell = (cell) => $(cell).data("total") === true;
    const isTotalOrSubtotalCell = (cell) => $(cell).data("subtotal") === true || $(cell).data("total") === true;
    const isTotalRow = (cell) => $(cell).data("total-row") === true;

    const columnSeries = $(data.target).data("series");

    let isSeries = false;
    const metric = slice.datasource.metrics.find((m) => m.verbose_name === columnName);

    if (metric) {
      columnVerboseName = metric.metric_name;
    }

    let attr = "groupby";

    if (columnSeries) {
      isSeries = true;
      columnName = columnSeries;
      const col = slice.datasource.columns.find((c) => c.verbose_name === columnSeries);

      if (col) {
        columnVerboseName = col.verbose_name || col.column_name;
      }
      attr = "columns";
    }

    if (!columnVerboseName) {
      const col = slice.datasource.columns.find((c) => c.column_name === columnName);
      columnVerboseName = col && col.verbose_name ? col.verbose_name : columnName;
    }

    const hierarcyManager = new Hierarchy(slice, payload);

    const seriesColumns = $(data.target)
      .data("series-columns")
      .split(/,(?=\S)/);
    const contextFilters = [];
    const eventValueIndex = normalizeCellIndex(data.target);

    if (eventValueIndex !== null) {
      // if null then drilldown is contextless
      seriesColumns.forEach((column, indexSeriesColumns) => {
        if (!column) {
          return;
        }
        if (targetCellInTableThead) {
          const targetColumn = $(data.target).data("series");
          const targetIndex = seriesColumns.indexOf(targetColumn);
          if (targetIndex < indexSeriesColumns) {
            return;
          }

          if (targetIndex === indexSeriesColumns && !isTotalOrSubtotalCell(targetCell)) {
            contextFilters.push({
              col: getColumnName(column),
              op: "in",
              val: targetCell.text().replaceAll(regExpPlug, quot),
            });
            return;
          }
        }
        const verboseName = getVerboseName(column);
        const series = normalizeSeriesCells(data.target, column, verboseName);

        if (!isTotalCell(targetCell)) {
          // обыкновенная ячейка
          const seriesCell = series.find((_, index) => index === eventValueIndex);
          let seriesValue = null;
          if (seriesCell && !isTotalOrSubtotalCell(seriesCell) && "innerText" in seriesCell) {
            seriesValue = seriesCell.innerText;
          } else if (isTotalOrSubtotalCell(seriesCell)) {
            // столбец итого
            // находим все ячейки серии
            const partTree = columnTree.find((part) => part.columnName === column);
            const seriesCells = partTree.values?.slice(0, eventValueIndex).reverse() ?? [];
            const childrenContextFilters = [];
            try {
              seriesCells.forEach((cell) => {
                if (!cell.isValue) {
                  throw new Error();
                }
                childrenContextFilters.push({
                  col: getColumnName(column),
                  op: "in",
                  val: cell.value.replaceAll(regExpPlug, quot),
                });
              });
            } catch (e) {
              //console.log();
            } finally {
              // добавляем фильтр в качестве дочерних
              if (childrenContextFilters.length) {
                contextFilters.push({
                  children: _.uniqWith(childrenContextFilters, _.isEqual),
                  conjuction: "and",
                });
              }
            }
          }
          if (seriesValue !== null) {
            contextFilters.push({
              col: getColumnName(column),
              op: "in",
              val: seriesValue.replaceAll(regExpPlug, quot),
            });
          }
        } else {
          // ячейка столбца Всего
          const seriesValues = [];
          let startIndex = eventValueIndex - 1;
          while (startIndex >= 0 && series[startIndex].innerText.length && !isTotalCell(series[startIndex])) {
            seriesValues.push(series[startIndex].innerText.replaceAll(regExpPlug, quot));
            startIndex--;
          }
          if (seriesValues.length) {
            contextFilters.push({
              col: getColumnName(column),
              op: "in",
              val: [].concat(seriesValues),
            });
          }
        }
      });
    }

    const filterColumns = $(data.target)
      .data("columns")
      .split(/,(?=\S)/);
    const lastThInRow = $(targetCell)
      .closest("tr")
      .find("th:last");
    const currentColumnIndex = filterColumns.indexOf(columnName);
    if (!isSubtotalCell(targetCell) && !isTotalRow(targetCell) && !targetCellIsThead) {
      // не строка Итого
      filterColumns.forEach((column, index) => {
        let filterValue;
        if (index !== filterColumns.length - 1) {
          filterValue = lastThInRow.data(`column-${column}`) || null;
        } else {
          const nearestHeaderCell = $(data.target)
            .parent("tr")
            .find(`[data-column="${column}"]`);
          const seriesName = getVerboseName(nearestHeaderCell.data("series-columns"));
          const headerCellValue = getVerboseName(nearestHeaderCell.text());
          filterValue = seriesName !== headerCellValue ? headerCellValue : null;
        }
        const verboseName = getVerboseName(column);
        const filterColumnName = getColumnName(column);
        if (filterValue && verboseName !== filterValue) {
          let newVal = filterValue;
          if(typeof filterValue === 'string') {
            newVal = filterValue.replaceAll(regExpPlug, quot)
          }
          contextFilters.push({
            col: getColumnName(filterColumnName),
            op: "in",
            val: newVal,
          });
        }
      });
    } else if (targetCellIsThead && !isSubtotalCell(targetCell) && !targetCellInTableThead && !isTotalRow(targetCell)) {
      filterColumns.forEach((column, index) => {
        let filterValue;
        if (index !== currentColumnIndex) {
          if (targetCell.attr(`data-column-${column}`) !== undefined) {
            filterValue = targetCell.attr(`data-column-${column}`);
          }
        } else {
          filterValue = targetCell.text();
        }
        if (filterValue) {
          let newVal = filterValue;
          if(typeof filterValue === 'string') {
            newVal = filterValue.replaceAll(regExpPlug, quot)
          }
          contextFilters.push({
            col: getColumnName(column),
            op: "and",
            val: newVal,
          });
        }
      });
    } else if (!targetCellInTableThead && !isTotalRow(targetCell)) {
      // под впросом может для строки <Всего> надо так же собрать все значения....
      const currentRow = $(targetCell).closest("tr");
      const thSubTotal = currentRow.find('th[data-subtotal="true"]');
      const currentColumn = thSubTotal.data("column");
      const previewCell = {};
      filterColumns.forEach((column) => {
        if (column !== currentColumn && thSubTotal.attr(`data-column-${column}`) !== undefined) {
          contextFilters.push({
            col: getColumnName(column),
            op: "and",
            val: thSubTotal.attr(`data-column-${column}`).replaceAll(regExpPlug, quot),
          });
          previewCell[column] = thSubTotal.attr(`data-column-${column}`);
        } else {
          const filter = Object.keys(previewCell)
            .map((c) => `[data-column-${c}="${previewCell[c]}"]`)
            .join("");
          const filterValuesCell = targetCell
            .closest("tbody")
            .find(`th${filter}[data-column="${column}"]`)
            .not("[data-subtotal],[data-not-data],[data-total],[data-total-row]");
          const childrenContextFilters = [];
          filterValuesCell.each((_, cell) => {
            if ("innerText" in cell) {
              childrenContextFilters.push({
                col: getColumnName(column),
                op: "in",
                val: cell.innerText.replaceAll(regExpPlug, quot),
              });
            }
          });
          // добавляем фильтр в качестве дочерних
          if (childrenContextFilters.length) {
            contextFilters.push({
              children: _.uniqWith(childrenContextFilters, _.isEqual),
              conjuction: "and",
            });
          }
        }
      });
    }
    const urlDrilldowns = hierarcyManager.getUrlDrilldowns(columnVerboseName, contextFilters);
    if (columnSeries) {
      columnName = columnSeries;
      isSeries = true;
    }
    const hierarchyDrilldowns = [];
    payload.hierarchy.forEach((h) => {
      if (slice.formData.disabled_hierarchy.findIndex((dh) => dh === h.id) !== -1) {
        return;
      }

      const hierarchyColumns = h.columns.filter((c) => c.groupby === true);

      const currentHierarchyDrilldown = [];
      const mapColumnToDrilldown = (hierarchyColumn) => {
        const columnIndexFormData = slice.formData[attr].indexOf(hierarchyColumn.name);

        const valueIsColumn = hierarchyColumns.find((item) => item.verbose_name === columnValue);
        const hierarchyColumnActive = columnIndexFormData !== -1;
        const action =
          columnIndexFormData === 0 || !contextMenuEnabled()
            ? () => {}
            : () => {
                // top level column can't be revert
                let hierarchyContextFilters = [];
                if (!hierarchyColumnActive) {
                  const withContext =
                    (!valueIsColumn && columnVerboseName !== columnValue && columnValue !== t("All")) ||
                    (valueIsColumn && columnValue !== valueIsColumn.verbose_name);
                  if (withContext) {
                    hierarchyContextFilters = contextFilters;
                  }
                } else {
                  hierarchyContextFilters = contextFilters;
                  // hierarchyColumnActive = !hierarchyColumnActive;
                }

                hierarchyContextFilters.map((f) => {
                  // eslint-disable-next-line no-param-reassign
                  f.drillDownCol = hierarchyColumn.name;
                  // eslint-disable-next-line no-param-reassign
                  f.hierarchyColumn = hierarchyColumn;
                  return f;
                });
                hierarcyManager.drilldownToHierarchy(
                  hierarchyColumn,
                  hierarchyContextFilters,
                  hierarchyColumnActive,
                  attr,
                  hierarchyColumns
                );
              };

        const drilldown = {
          id: hierarchyColumn.id,
          order: hierarchyColumn.order,
          title: hierarchyColumnActive
            ? `<i class="fa fa-check" aria-hidden="true"></i>  ${hierarchyColumn.verbose_name || hierarchyColumn.name}`
            : hierarchyColumn.verbose_name || hierarchyColumn.name,
          action,
        };
        return drilldown;
      };

      const nextColumns = h.columns
        .filter((hierarchyColumn) => slice.formData[attr].includes(hierarchyColumn.name))
        .map((hierarchyColumn) => hierarcyManager.getNextColumnByHierarchy(h, hierarchyColumn))
        .filter((item) => item);
      nextColumns.forEach((item) => {
        currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
      });

      if (currentHierarchyDrilldown.length) {
        h.columns.forEach((c) => {
          if ((c.verbose_name || c.name) === columnVerboseName) {
            hierarchyDrilldowns.push({ title: h.verbose_name || h.name });
            currentHierarchyDrilldown.forEach((item) => {
              hierarchyDrilldowns.push(item);
            });
          }
        });
      }
    });

    const isMetric = data.target.tagName.toLowerCase() === "td";
    const menuItems = isMetric ? [...urlDrilldowns] : [...hierarchyDrilldowns, ...urlDrilldowns];
    return menuItems;
  };
  const div = d3.select(slice.selector);
  const paginationContainer = div.append("div");

  // подсветка возможности DD для элементов названия th
  document.querySelectorAll(`#${slice.containerId} table th`).forEach((th) => {
    const items = menu({ target: th });
    if (th && items?.some?.((item) => allIdsHierarchy.has(item.id))) {
      th.classList.add("contextMenuCursor");
    }
  });

  const handlePagination = (pageOffset) => {
    const isStopAsync = true;
    slice.formData.page_offset = pageOffset;
    slice.props.actions.runQuery(slice.formData, false, slice.props.timeout, slice.props.chartKey, isStopAsync);
  };

  // подсветка возможности DD
  tablePivotDDVisualization(slice, payload, menu);

  ReactDOM.render(
    <Pagination
      total={payload.total_found}
      rowLimit={slice.formData.row_limit || payload.form_data.row_limit}
      pageLength={parseInt(slice.formData.page_length, 10)}
      pageOffset={payload.form_data.page_offset || slice.formData.page_offset}
      onChange={handlePagination}
      onHeightChange={(height) => slice.appendPaginationHeight(height)}
      slice={slice}
    />,
    paginationContainer.node(),
    () => {
      if (showLegend) {
        const legendContainer = d3.select(`#${slice.containerId}-legend`);
        if (!legendContainer?.[0]?.[0]) {
          d3.select(`#${slice.containerId}`)
            .insert("div", "table")
            .attr("id", `${slice.containerId}-legend`);
        }
        renderLegend(`#${slice.containerId}-legend`, conditionalFormatting, slice.width());
      }
    }
  );

  d3.selectAll(`#${slice.containerId} table`).on("contextmenu", () => {
    const items = menu(d3.event);
    if (items.length) {
      d3.contextMenu(() => items)(d3.event);
      // fix menu position to prevent going righter screen
      const d3menu = d3.select(".d3-context-menu");
      const widthStr = d3menu.style("width");
      const width = parseInt(widthStr.substring(0, widthStr.length - 2), 10);
      if (d3.event.x + width > window.innerWidth - 20) {
        d3menu.style("left", "auto");
        d3menu.style("right", 0);
      }
    }
  });
}
