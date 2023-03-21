import React from "react";
import ReactDOM from "react-dom";
import contextmenu from "d3-context-menu";
import d3 from "d3";
import dt from "datatables.net-bs";
import "datatables.net-bs/css/dataTables.bootstrap.css";
import { t } from "../javascripts/locales";
import { contextMenuEnabled } from "../utils/context_menu";
import { d3format, d3TimeFormatPreset, fixDataTableBodyHeight } from "../javascripts/modules/utils";

import "./table.css";

import Pagination from "../javascripts/components/Pagination";
import { Hierarchy } from "../utils/hierarchy";
import {
  getBackgroundConditionalFormatting,
  getColorConditionalFormatting,
  isCellForConditionalFormatting,
} from "../utils/table";
import { ORDER_SORTING } from "../javascripts/explore/constants";
import { tableDDVisualization } from "./helpers/ddVisualization/tableDDVisualization";

const $ = require("jquery");

export const getMaxOfRecords = (records) =>
  records.reduce((acc, item) => {
    const max = Math.max(...Object.values(item).filter((item) => typeof item === "number"));
    return max > acc ? max : acc;
  }, -9999999999);

dt(window, $);
const LEGEND_MAX_KEY_LENGTH = 1000;

const getAdjustedLabelValue = (label) => (label.length < 21 ? label : `${label.slice(0, 20)}...`);

export const renderLegend = (selector, conditional_formatting, width) => {
  const colors = [];
  const labels = [];
  conditional_formatting.forEach(({ color, description }) => {
    colors.push(`rgb(${color.r}, ${color.g}, ${color.b})`);
    labels.push(description);
  });
  const div = d3.select(selector);
  div.selectAll("*").remove();
  const svg = div
    .append("svg")
    .attr("width", width)
    .attr("class", "nv-wrapper")
    .style("position", "static");

  const legend = nv.models
    .legend()
    .color((d) => colors[d.index])
    .width(width - 20)
    .rightAlign(false)
    .maxKeyLength(LEGEND_MAX_KEY_LENGTH);
  const gLegend = svg
    .append("g")
    .attr("class", "nv-legendWrap")
    .datum(
      labels.map((label, index) => ({
        key: getAdjustedLabelValue(label),
        index,
      }))
    )
    .call(legend);
  const { height: legendHeight, width: legendWidth } = gLegend.node().getBoundingClientRect();
  svg.attr("height", legendHeight + 15);
  gLegend.attr("transform", `translate(${(width - legendWidth) / 2},0)`);

  gLegend
    .selectAll(".nv-series")
    .append("title")
    .html(({ index }) => labels[index]);
};

function tableVis(slice, payload) {
  const allIdsHierarchy = new Set(payload?.hierarchy?.flatMap?.((h) => h.columns.map((column) => column.id)) ?? []);
  const container = $(slice.selector);
  const fC = d3.format("0,000");
  const { utc_offset } = payload;
  const data = payload.data;
  const fd = slice.formData;
  let tableCols = payload.data.columns;
  if (Array.isArray(tableCols[0])) {
    tableCols = tableCols.map((col) => col[0]);
  }
  const maxValueOfRecords = getMaxOfRecords(data?.records);

  // const defaultMetricFormat = slice.datasource.column_formats || '.3s'
  const commonMetricFormat = fd?.number_format;

  const getFormatValue = (metricFullName, value, formatOnTheFly) => {
    const column_formats = {
      ...payload?.form_data?.column_format,
      ...slice.datasource.column_format,
    };
    const defaultMetricFormat = slice.datasource.column_formats
      ? slice.datasource.column_formats[metricFullName]
      : commonMetricFormat || ".3s";
    // formatOnTheFly - значение формата для метрики на лету в попапе
    // specificMetricFormat - для метрики на уровне витрины - одно и то же значение на уровне витрины и в самом попапе метрики
    const specificMetricFormat =
      (column_formats !== undefined && (column_formats[metricFullName] || column_formats[metricFullName.slice(1)])) ||
      defaultMetricFormat;
    if (typeof value === "number") {
      let format = formatOnTheFly || specificMetricFormat;
      const metricHasEmptyValue =
        (column_formats !== undefined && column_formats[metricFullName] === "") || formatOnTheFly === "";
      if (metricHasEmptyValue) {
        format = commonMetricFormat;
      }
      return d3format(format, value);
    }
  };

  // определяем массив колонок которые показывают DATE / TIME
  const {
    granularity_sqla: granularitySqla,
    show_legend: showLegend,
    conditional_formatting,
    conditional_formatting_percentage: percentageRange,
  } = fd;
  const { columns } = slice;
  const dateTimeColumns = columns
    .filter((column) => column.is_dttm)
    .map((column) => column.column_name)
    .concat(["__timestamp"]);
  if (granularitySqla) {
    dateTimeColumns.push(granularitySqla);
  }

  let metrics = fd.metrics || [];
  // Add percent metrics
  metrics = metrics.concat((fd.percent_metrics || []).map((m) => "%" + m));

  function col(c) {
    const arr = [];
    for (let i = 0; i < data.records.length; i += 1) {
      arr.push(data.records[i][c]);
    }
    return arr;
  }
  const maxes = {};
  const mins = {};
  for (let i = 0; i < metrics.length; i += 1) {
    if (fd.align_pn) {
      maxes[metrics[i]] = d3.max(col(metrics[i]).map(Math.abs));
    } else {
      maxes[metrics[i]] = d3.max(col(metrics[i]));
      mins[metrics[i]] = d3.min(col(metrics[i]));
    }
  }

  const tsFormatter = d3TimeFormatPreset(fd.table_timestamp_format, utc_offset, fd.time_grain_sqla);

  const getTitleValue = (data) => {
    const { val, col: c } = data;
    const isMetric = metrics.some((metric) => (typeof metric === "string" ? metric === c : metric.label === c));
    if (dateTimeColumns.indexOf(c) > -1) {
      return tsFormatter(val);
    } else if (isMetric) {
      return slice.d3format(c, val);
    } else if (c[0] === "%") {
      return d3.format(".3p")(val);
    }
    return val;
  };

  contextmenu(d3);
  const menu = (data, includeUrlDrilldowns = true) => {
    let columnName = data;
    let columnValue = null;
    if (typeof data === "object") {
      columnName = data.col;
      // if clicked row value
      if (!data.isMetric) columnValue = data.val;
    }

    let attr = "all_columns";
    if (slice.formData.groupby.length > 0) {
      attr = "groupby";
    }

    const hierarcyManager = new Hierarchy(slice, payload);
    const contextFilters = [];
    const filterColumns = slice.formData[attr];
    filterColumns.forEach((column) => {
      if (!data.row) {
        // header click
        return;
      }
      const val = data.row[column];
      contextFilters.push({ col: column, val, count: data.row.count });
    });
    const urlDrilldowns = includeUrlDrilldowns ? hierarcyManager.getUrlDrilldowns(columnName, contextFilters) : [];

    const hierarchyDrilldowns = [];

    payload.hierarchy.forEach((h) => {
      if (slice.formData.disabled_hierarchy.findIndex((dh) => dh === h.id) !== -1) {
        return;
      }

      const attr = (slice.formData.groupby || []).length ? "groupby" : "all_columns";

      const currentHierarchyDrilldown = [];
      const mapColumnToDrilldown = (hierarchyColumn) => {
        const columnIndexFormData = slice.formData[attr].indexOf(hierarchyColumn.name);

        const hierarchyColumnActive = columnIndexFormData !== -1;
        const drilldown = {
          id: hierarchyColumn.id,
          order: hierarchyColumn.order,
          title: hierarchyColumnActive
            ? `<i class="fa fa-check" aria-hidden="true"></i>  ${hierarchyColumn.verbose_name || hierarchyColumn.name}`
            : hierarchyColumn.verbose_name || hierarchyColumn.name,
          action:
            columnIndexFormData === 0 || !contextMenuEnabled()
              ? () => {}
              : () => {
                  // top level column can't be revert
                  const hierarchyContextFilters = [];
                  // hierarchyColumnActive = false;
                  if (columnValue !== null && columnValue !== t("All")) {
                    for (const item in data.row) {
                      if (metrics.includes(item)) {
                        continue;
                      }
                      hierarchyContextFilters.push({
                        col: item,
                        op: "in",
                        val: [data.row[item]],
                        drillDownCol: hierarchyColumn.name,
                        hierarchyColumn,
                      });
                    }
                  }
                  hierarcyManager.drilldownToHierarchy(
                    hierarchyColumn,
                    hierarchyContextFilters,
                    hierarchyColumnActive,
                    attr,
                    h.columns
                  );
                },
        };
        return drilldown;
      };

      if (!slice.formData[attr].length && h.columns[0]) {
        const nextColumn = hierarcyManager.getNextColumnByHierarchy(h, h.columns[0]);
        if (nextColumn) {
          currentHierarchyDrilldown.push(mapColumnToDrilldown(nextColumn));
        }
      } else {
        // Если есть, для каждого ищется следующий по иерархии
        const nextColumns = h.columns
          .filter((hierarchyColumn) => slice.formData[attr].includes(hierarchyColumn.name))
          .map((hierarchyColumn) => hierarcyManager.getNextColumnByHierarchy(h, hierarchyColumn))
          .filter((item) => item);
        nextColumns // Если найденный следующий уже присутствует в группировке - его не предлагать
          .forEach((item) => {
            currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
          });
      }

      if (currentHierarchyDrilldown.length) {
        h.columns.forEach((c) => {
          if ((c.name || c.verbose_name) === columnName) {
            hierarchyDrilldowns.push({ title: h.verbose_name || h.name });
            currentHierarchyDrilldown.forEach((item) => {
              hierarchyDrilldowns.push(item);
            });
          }
        });
      }
    });

    return data.isMetric ? [...urlDrilldowns] : [...hierarchyDrilldowns, ...urlDrilldowns];
  };

  const div = d3.select(slice.selector);
  div.html("");
  const table = div
    .append("table")
    .classed("dataframe dataframe table table-striped " + "table-condensed table-hover dataTable no-footer", true)
    .attr("width", "100%");

  const verboseMap = slice.datasource.verbose_map;
  const cols = data.columns.map((c) => {
    if (verboseMap[c]) {
      return {
        col: c,
        html: verboseMap[c],
      };
    }
    // Handle verbose names for percents
    if (c[0] === "%") {
      const cName = c.substring(1);
      return {
        col: c,
        html: "% " + (verboseMap[cName] || cName),
      };
    }
    return {
      col: c,
      html: c,
    };
  });
  const sortBys = {};
  if (fd.order_by_metric) {
    // Sort by as specified
    fd.order_by_metric.forEach(([column, direction]) => {
      sortBys[column] = direction;
    });
  }
  const handleSort = ({ col: column }) => {
    const isStopAsync = true;
    const { order_by_metric: orderByMetricFormData } = slice.formData;
    const orderByMetric = orderByMetricFormData || [];
    const index = orderByMetric.findIndex(([orderColumn]) => orderColumn === column);
    if (index > -1) {
      const [, direction] = orderByMetric[index];
      if (direction === ORDER_SORTING.ASC) {
        orderByMetric[index] = [column, ORDER_SORTING.DESC];
      } else {
        orderByMetric.splice(index, 1);
      }
    } else {
      orderByMetric.push([column, ORDER_SORTING.ASC]);
    }

    slice.props.actions.runQuery(
      {
        ...slice.formData,
        order_by_metric: orderByMetric,
      },
      false,
      slice.props.timeout,
      slice.props.chartKey,
      isStopAsync
    );
  };
  table
    .append("thead")
    .append("tr")
    .selectAll("th")
    .data(cols)
    .enter()
    .append("th")
    .attr("class", (d) => {
      const { col: columnName } = d;
      const c = columnName.replace(/^%/, "");
      return `sorting${sortBys[c] ? "_" + sortBys[c] : ""}`;
    })
    .classed("contextMenuCursor", (data) => {
      const items = menu(data);
      return !!items?.some?.((item) => allIdsHierarchy.has(item.id));
    })
    .text(function(d) {
      return d.html;
    })
    .on("contextmenu", (data) => {
      const items = menu(data, false);
      if (items.length) {
        d3.contextMenu(() => items)();
        // fix menu position to prevent going righter screen
        const d3menu = d3.select(".d3-context-menu");
        const widthStr = d3menu.style("width");
        const width = parseInt(widthStr.substring(0, widthStr.length - 2), 10);
        if (d3.event.x + width > window.innerWidth - 20) {
          d3menu.style("left", "auto");
          d3menu.style("right", 0);
        }
      }
    })
    .on("click", handleSort);

  table
    .append("tbody")
    .selectAll("tr")
    .data(data.records)
    .enter()
    .append("tr")
    .selectAll("td")
    .data((row) =>
      data.columns.map((c) => {
        const val = row[c];
        let html;
        const isMetric = metrics.some((metric) => (typeof metric === "string" ? metric === c : metric.label === c));
        if (dateTimeColumns.indexOf(c) > -1) {
          html = tsFormatter(val);
        } else if (isMetric) {
          html = slice.d3format(c, val);
        } else if (c[0] === "%") {
          html = d3.format(".3p")(val);
        } else {
          html = `<span class="like-pre">${val}</span>`;
        }
        return {
          col: c,
          val,
          html,
          isMetric,
          row,
        };
      })
    )
    .enter()
    .append("td")
    .style("background-color", (d) =>
      isCellForConditionalFormatting(d)
        ? getBackgroundConditionalFormatting(d.val, conditional_formatting, maxValueOfRecords, percentageRange)
        : null
    )
    .style("color", (d) =>
      isCellForConditionalFormatting(d)
        ? getColorConditionalFormatting(d.val, conditional_formatting, maxValueOfRecords, percentageRange)
        : null
    )
    .style("background-image", function(d) {
      if (d.isMetric) {
        const r = fd.color_pn && d.val < 0 ? 150 : 0;
        if (fd.align_pn) {
          const perc = Math.abs(Math.round((d.val / maxes[d.col]) * 100));
          // The 0.01 to 0.001 is a workaround for what appears to be a
          // CSS rendering bug on flat, transparent colors
          return (
            `linear-gradient(to right, rgba(${r},0,0,0.2), rgba(${r},0,0,0.2) ${perc}%, ` +
            `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`
          );
        }
        const posExtent = Math.abs(Math.max(maxes[d.col], 0));
        const negExtent = Math.abs(Math.min(mins[d.col], 0));
        const tot = posExtent + negExtent;
        const perc1 = Math.round((Math.min(negExtent + d.val, negExtent) / tot) * 100);
        const perc2 = Math.round((Math.abs(d.val) / tot) * 100);
        // The 0.01 to 0.001 is a workaround for what appears to be a
        // CSS rendering bug on flat, transparent colors
        return (
          `linear-gradient(to right, rgba(0,0,0,0.01), rgba(0,0,0,0.001) ${perc1}%, ` +
          `rgba(${r},0,0,0.2) ${perc1}%, rgba(${r},0,0,0.2) ${perc1 + perc2}%, ` +
          `rgba(0,0,0,0.01) ${perc1 + perc2}%, rgba(0,0,0,0.001) 100%)`
        );
      }
      return null;
    })
    .classed("contextMenuCursor", (data) => {
      const items = menu(data);
      return !!items.length;
    })
    .classed("text-right", (d) => d.isMetric)
    .attr("title", (d) => getTitleValue(d))
    .attr("data-sort", function(d) {
      return d.val;
    })
    .on("contextmenu", (data) => {
      const items = menu(data);
      if (items.length) {
        d3.contextMenu(() => items)();
      }
    })
    .html((d) => {
      if (d.html && !d.isMetric) return d.html;
      if (!d.isMetric) return d.val;
      const appropriateMetricOnTheFly = metrics?.find(
        (metric) => typeof metric !== "string" && metric?.label === d.col
      );
      let formatOnTheFly;
      if (appropriateMetricOnTheFly) {
        formatOnTheFly = appropriateMetricOnTheFly.customNumberFormat?.value;
      }
      return getFormatValue(d.col, d.val, formatOnTheFly);
    });
  const paginationContainer = div.append("div");
  const height = slice.height();
  let paging = false;
  let pageLength;
  if (fd.page_length && fd.page_length > 0) {
    paging = true;
    pageLength = parseInt(fd.page_length, 10);
  }

  const datatable = container.find(".dataTable").DataTable({
    paging: false, // стандартный пагинатор заменен кастомным
    pageLength,
    aaSorting: [],
    searching: fd.include_search,
    bInfo: false,
    scrollY: height + 29 + "px",
    scrollCollapse: true,
    scrollX: true,
    language: {
      search: t("Search"),
      zeroRecords: t("No matching records found"),
    },
  });

  fixDataTableBodyHeight(container.find(".dataTables_wrapper"), height);
  datatable.draw();

  container
    .parents(".widget")
    .find(".tooltip")
    .remove();

  const handlePagination = (pageOffset) => {
    const isStopAsync = true;
    slice.formData.page_offset = pageOffset;
    slice.props.actions.runQuery(slice.formData, false, slice.props.timeout, slice.props.chartKey, isStopAsync);
  };
  ReactDOM.render(
    <Pagination
      total={payload.total_found}
      rowLimit={slice.formData.row_limit || payload.form_data.row_limit}
      pageLength={parseInt(slice.formData.page_length, 10)}
      pageOffset={payload.form_data.page_offset || slice.formData.page_offset}
      onHeightChange={(height) => slice.appendPaginationHeight(height)}
      onChange={handlePagination}
      slice={slice}
    />,
    paginationContainer.node(),
    () => {
      if (showLegend) {
        const legendContainer = d3.select(`#${slice.containerId}-legend`);
        if (!legendContainer?.[0]?.[0]) {
          d3.select(`#${slice.containerId} .col-sm-12`)
            .insert("div", ".dataTables_scroll")
            .attr("id", `${slice.containerId}-legend`);
        }
        renderLegend(`#${slice.containerId}-legend`, conditional_formatting, slice.width());
      }
    }
  );

  // подсветка возможности DD
  tableDDVisualization(slice, payload);
}

export default tableVis;
