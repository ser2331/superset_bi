import React from 'react';
import ReactDOM from 'react-dom';
import d3 from 'd3';
import contextmenu from 'd3-context-menu';
import { t } from '../javascripts/locales';

import dt from 'datatables.net-bs';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import $ from 'jquery';

import { d3format, fixDataTableBodyHeight } from '../javascripts/modules/utils';
import './pivot_table.css';

import Pagination from '../javascripts/components/Pagination';
import { Hierarchy } from '../utils/hierarchy';

require('d3-context-menu/css/d3-context-menu.css');

contextmenu(d3);

dt(window, $);

/**
 * @param {HTMLTableCellElement} target Context menu event target
 * @returns {number} Clicked <td> cell index relatively to other cells in the row
 */
function normalizeCellIndex(target) {
  let cellIndex = null;
  const array = target.tagName === 'TD'
      ? $(target).parent('tr').find('td').toArray()
      : $(target).parent('tr').find('th').toArray().filter(item => !item.dataset.column);
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
  const seriesCells = $(target).closest('table').find(`th[data-series="${series}"]`);
  const seriesHeader = seriesCells.filter(`:contains("${verboseName}"), :contains("${series}")`);
  const normalizedSeries = [];
  seriesCells.toArray()
    .filter((_, index) => index > seriesHeader.index())
    .forEach((column) => {
      const colspan = column.attributes.colspan
        ? Number.parseInt(column.attributes.colspan.value, 10)
        : 1;
      for (let i = 0; i < colspan; i++) {
        normalizedSeries.push(column);
      }
    });
  return normalizedSeries;
}

module.exports = function (slice, payload) {
  const getVerboseName = (columnName) => {
    const matchingColumn = slice.columns.find(item => item.column_name === columnName);
    if (matchingColumn) {
        return matchingColumn.verbose_name || columnName;
    }
    const matchingMetric = slice.metrics.find(item => item.metric_name === columnName);
    if (matchingMetric) {
        return matchingMetric.verbose_name || columnName;
    }
    return columnName;
  };

  const getColumnName = (verboseName) => {
    const matchingColumn = slice.columns.find(item => item.verbose_name === verboseName);
    if (matchingColumn) {
        return matchingColumn.column_name || verboseName;
    }
    const matchingMetric = slice.metrics.find(item => item.verbose_name === verboseName);
    if (matchingMetric) {
        return matchingMetric.metric_name || verboseName;
    }
    return verboseName;
  };
  const container = slice.container;
  const fd = slice.formData;
  const height = container.height();
  let cols = payload.data.columns;
  if (Array.isArray(cols[0])) {
    cols = cols.map(col => col[0]);
  }

  // payload data is a string of html with a single table element
  container.html(payload.data.html);

  // jQuery hack to set verbose names in headers
  const replaceCell = function () {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = slice.datasource.verbose_map[s] || s;
  };
  slice.container.find('thead tr:first th').each(replaceCell);
  slice.container.find('thead tr th:first-child').each(replaceCell);

  // jQuery hack to format number
  slice.container.find('tbody tr').each(function () {
    $(this).find('td').each(function (i) {
      const metric = cols[i];
      const format = slice.datasource.column_formats[metric] || fd.number_format || '.3s';
      const tdText = $(this)[0].textContent;
      if (!isNaN(tdText) && tdText !== '') {
        $(this)[0].textContent = d3format(format, tdText);
      }
    });
  });

  container.css('overflow', 'auto');
  container.css('height', `${height + 10}px`);

  // TODO: порефакторить
  const menu = (data) => {
    /**
     * <td
     * data-columns="Вид ДТП (наименование)"
     * data-series-columns="Участок дороги (наименование)"
     * data-column="Количество ДТП"
     * >4.00</td>
     */
    /* TODO: Вынести в функцию */
    let columnName = $(data.target).data('column');
    const columnValue = $(data.target).text();

    const columnSeries = $(data.target).data('series');

    let isSeries = false;

    const metric = slice.datasource.metrics.find(m => m.verbose_name === columnName);
    if (metric) {
      columnName = metric.metric_name;
    }
    let attr = 'groupby';

    if (columnSeries) {
        isSeries = true;
        columnName = columnSeries;
        const col = slice.datasource.columns.find(c => c.verbose_name === columnSeries);
        if (col) {
          columnName = col.column_name;
        }
        attr = 'columns';
    }

    const hierarcyManager = new Hierarchy(slice, payload);
    const seriesColumns = $(data.target).data('series-columns').split(',');
    const contextFilters = [];
    const eventValueIndex = normalizeCellIndex(data.target);
    if (eventValueIndex !== null) { // if null then drilldown is contextless
      seriesColumns.forEach((column) => {
        if (!column) {
          return;
        }
        const verboseName = getVerboseName(column);
        const series = normalizeSeriesCells(data.target, column, verboseName);
        const seriesValue = series.find((_, index) => index === eventValueIndex).innerText;
        contextFilters.push({
          col: getColumnName(column),
          op: 'in',
          val: seriesValue,
        });
      });
    }
    const filterColumns = $(data.target).data('columns').split(',');
    filterColumns.forEach((column, index) => {
      let filterValue;
      if (index !== filterColumns.length - 1) {
        // All filters except the last one could be combined via rowspan in first row
        // and will not be present in data.target row, so we should check first row for them
        const firstRow = $(data.target).closest(data.target.tagName === 'TH' ? 'thead' : 'tbody').find('tr').first();
        const nearestHeaderCell = firstRow.find(`[data-column="${column}"]`);
        const seriesName = getVerboseName(nearestHeaderCell.data('series'));
        const headerCellValue = getVerboseName(nearestHeaderCell.text());
        filterValue = seriesName !== headerCellValue ? headerCellValue : null;
      } else {
        const nearestHeaderCell = $(data.target).parent('tr').find(`[data-column="${column}"]`);
        const seriesName = getVerboseName(nearestHeaderCell.data('series'));
        const headerCellValue = getVerboseName(nearestHeaderCell.text());
        filterValue = seriesName !== headerCellValue ? headerCellValue : null;
      }
      const verboseName = getVerboseName(column);
      const filterColumnName = getColumnName(column);
      if (filterValue && verboseName !== filterValue) {
          contextFilters.push({ col: filterColumnName, op: 'in', val: filterValue });
      }
    });
    const urlDrilldowns = hierarcyManager.getUrlDrilldowns(columnName, contextFilters);

    if (columnSeries) {
      columnName = columnSeries;
      isSeries = true;
    }
    const hierarchyDrilldowns = [];
    payload.hierarchy.forEach((h) => {
        if (slice.formData.disabled_hierarchy.findIndex(dh => dh === h.id) !== -1) {
          return;
        }

        const hierarchyColumns = h.columns.filter(c => c.groupby === true);
        const currentHierarchyDrilldown = [];
        const mapColumnToDrilldown = (hierarchyColumn) => {
            const columnIndexFormData = slice.formData[attr].indexOf(hierarchyColumn.name);
            const valueIsColumn = hierarchyColumns.find(item => item.verbose_name === columnValue);
            const hierarchyColumnActive = columnIndexFormData !== -1;
            const action = columnIndexFormData === 0 ? () => {} : () => { // top level column can't be revert
                let hierarchyContextFilters = [];
                if (!hierarchyColumnActive) {
                  const withContext = (!valueIsColumn && columnName !== columnValue && columnValue !== t('All'))
                      || (valueIsColumn && columnValue !== valueIsColumn.verbose_name);
                  if (withContext) {
                      hierarchyContextFilters = contextFilters;
                  }
                }
                hierarcyManager.drilldownToHierarchy(hierarchyColumn, hierarchyContextFilters, hierarchyColumnActive, attr, hierarchyColumns);
            };
            const drilldown = {
                id: hierarchyColumn.id,
                order: hierarchyColumn.order,
                title: !hierarchyColumnActive
                    ? (hierarchyColumn.verbose_name || hierarchyColumn.name)
                    : `<i class="fa fa-check" aria-hidden="true"></i>  ${hierarchyColumn.verbose_name || hierarchyColumn.name}`,
                action,
            };
            return drilldown;
        };

      const nextColumns = h.columns
          .filter(hierarchyColumn => slice.formData[attr].includes(hierarchyColumn.name))
          .map(hierarchyColumn => hierarcyManager.getNextColumnByHierarchy(h, hierarchyColumn))
          .filter(item => item);
      nextColumns
          .forEach((item) => {
              currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
          });

      if (currentHierarchyDrilldown.length) {
        hierarchyDrilldowns.push({ title: h.verbose_name || h.name });
        currentHierarchyDrilldown.forEach((item) => {
            hierarchyDrilldowns.push(item);
        });
      }
    });

    const isMetric = data.target.tagName === 'TD';
    const menuItems = isMetric
      ? [ ...urlDrilldowns ]
      : [ ...hierarchyDrilldowns, ...urlDrilldowns ];
    return menuItems;
  };
  const div = d3.select(slice.selector);
  const paginationContainer = div.append('div');

  const handlePagination = (pageOffset) => {
    slice.formData.page_offset = pageOffset;
    slice.props.actions.runQuery(slice.formData, false, slice.props.timeout, slice.props.chartKey);
  };

  ReactDOM.render(
    <Pagination 
      total={payload.total_found}
      pageLength={slice.formData.page_length}
      pageOffset={payload.form_data.page_offset || slice.formData.page_offset}
      onChange={handlePagination}
      onHeightChange={height => slice.appendPaginationHeight(height)}
      slice={slice}
    />,
    paginationContainer.node()
  );
  d3.selectAll(`#${slice.containerId} table`).on('contextmenu', (event) => {
    const items = menu(d3.event);
    if (items.length) {
      d3.contextMenu(() => items)(d3.event);
      // fix menu position to prevent going righter screen
      const d3menu = d3.select('.d3-context-menu');
      const widthStr = d3menu.style('width');
      const width = parseInt(widthStr.substring(0, widthStr.length - 2), 10);
      if (d3.event.x  + width > window.innerWidth - 20) {
        d3menu.style('left', 'auto');
        d3menu.style('right', 0);
      }

    }
  });
};
