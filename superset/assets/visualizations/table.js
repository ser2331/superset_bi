import React from 'react';
import ReactDOM from 'react-dom';
import contextmenu from 'd3-context-menu';
import d3 from 'd3';
import dt from 'datatables.net-bs';
import { t } from '../javascripts/locales';

import 'datatables.net-bs/css/dataTables.bootstrap.css';

import { fixDataTableBodyHeight, d3TimeFormatPreset } from '../javascripts/modules/utils';
import './table.css';

import Pagination from '../javascripts/components/Pagination';
import { Hierarchy } from '../utils/hierarchy';

const $ = require('jquery');

dt(window, $);

function tableVis(slice, payload) {
  const container = $(slice.selector);
  const fC = d3.format('0,000');

  const data = payload.data;
  const fd = slice.formData;

  let metrics = fd.metrics || [];
  // Add percent metrics
  metrics = metrics.concat((fd.percent_metrics || []).map(m => '%' + m));

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

  const tsFormatter = d3TimeFormatPreset(fd.table_timestamp_format, fd.time_grain_sqla);
  contextmenu(d3);
  const menu = (data) => {
    let columnName = data;
    let columnValue = null;
    if (typeof (data) === 'object') {
      columnName = data.col;
      // if clicked row value
      if (!data.isMetric) columnValue = data.val;
    }

    let attr = 'all_columns';
    if (slice.formData.groupby.length > 0) {
      attr = 'groupby';
    }

    const hierarcyManager = new Hierarchy(slice, payload);
    const contextFilters = [];
    const filterColumns = slice.formData[attr];
    filterColumns.forEach((column) => {
      if (!data.row) { // header click
          return;
      }
      const val = data.row[column];
      contextFilters.push({ col: column, val });
    });

    const urlDrilldowns = hierarcyManager.getUrlDrilldowns(columnName, contextFilters);

    const hierarchyDrilldowns = [];

    payload.hierarchy.forEach((h) => {
      if (slice.formData.disabled_hierarchy.findIndex(dh => dh === h.id) !== -1) {
        return;
      }

      const attr = slice.formData.groupby ? 'groupby' : 'all_columns';

      const currentHierarchyDrilldown = [];
      const mapColumnToDrilldown = (hierarchyColumn) => {
          const columnIndexFormData = slice.formData[attr].indexOf(hierarchyColumn.name);
          const hierarchyColumnActive = columnIndexFormData !== -1;
          const drilldown = {
              id: hierarchyColumn.id,
              order: hierarchyColumn.order,
              title: !hierarchyColumnActive
                  ? (hierarchyColumn.verbose_name || hierarchyColumn.name)
                  : `<i class="fa fa-check" aria-hidden="true"></i>  ${hierarchyColumn.verbose_name || hierarchyColumn.name}`,
              action: columnIndexFormData === 0 ? () => {} : () => { // top level column can't be revert
                const hierarchyContextFilters = [];
                if (!hierarchyColumnActive) {
                  if (columnValue !== null && columnValue !== t('All')) {
                    for (const item in data.row) {
                      if (metrics.includes(item)) {
                          continue;
                      }
                      hierarchyContextFilters.push({
                        col: item,
                        op: 'in',
                        val: [data.row[item]],
                      });
                    }
                  }
                }
                hierarcyManager.drilldownToHierarchy(hierarchyColumn, hierarchyContextFilters, hierarchyColumnActive, attr, h.columns);
              },
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

    const menuItems = data.isMetric
        ? [ ...urlDrilldowns ]
        : [ ...hierarchyDrilldowns, ...urlDrilldowns ];
    return menuItems;
  };

  const div = d3.select(slice.selector);
  div.html('');
  const table = div.append('table')
    .classed(
      'dataframe dataframe table table-striped ' +
      'table-condensed table-hover dataTable no-footer', true)
    .attr('width', '100%');

  const verboseMap = slice.datasource.verbose_map;
  const cols = data.columns.map((c) => {
    if (verboseMap[c]) {
      return verboseMap[c];
    }
    // Handle verbose names for percents
    if (c[0] === '%') {
      const cName = c.substring(1);
      return '% ' + (verboseMap[cName] || cName);
    }
    return c;
  });

  table.append('thead').append('tr')
    .selectAll('th')
    .data(cols)
    .enter()
    .append('th')
    .text(function (d) {
      return d;
    })
    .on('contextmenu', (data) => {
      const items = menu(data);
      if (items.length) {
        d3.contextMenu(() => items)();
      }
    });

  table.append('tbody')
    .selectAll('tr')
    .data(data.records)
    .enter()
    .append('tr')
    .selectAll('td')
    .data(row => data.columns.map((c) => {
      const val = row[c];
      let html;
      const isMetric = metrics.some(metric => typeof metric === 'string' ? metric === c : metric.label === c);
      if (c === '__timestamp') {
        html = tsFormatter(val);
      }
      if (typeof (val) === 'string') {
        html = `<span class="like-pre">${val}</span>`;
      }
      if (isMetric) {
        html = slice.d3format(c, val);
      }
      if (c[0] === '%') {
        html = d3.format('.3p')(val);
      }
      return {
        col: c,
        val,
        html,
        isMetric,
        row,
      };
    }))
    .enter()
    .append('td')
    .style('background-image', function (d) {
      if (d.isMetric) {
        const r = (fd.color_pn && d.val < 0) ? 150 : 0;
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
    .classed('text-right', d => d.isMetric)
    .attr('title', (d) => {
      if (!isNaN(d.val)) {
        return fC(d.val);
      }
      return null;
    })
    .attr('data-sort', function (d) {
      return (d.isMetric) ? d.val : null;
    })
    .style('cursor', function (d) {
      return (!d.isMetric) ? 'pointer' : '';
    })
    .on('contextmenu', (data) => {
      const items = menu(data);
      if (items.length) {
        d3.contextMenu(() => items)();
        // fix menu position to prevent going righter screen
        const d3menu = d3.select('.d3-context-menu');
        const widthStr = d3menu.style('width');
        const width = parseInt(widthStr.substring(0, widthStr.length - 2), 10);
        if (d3.event.x  + width > window.innerWidth - 20) {
          d3menu.style('left', 'auto');
          d3menu.style('right', 0);
        }

      }
    })
    .html(d => d.html ? d.html : d.val);
  const paginationContainer = div.append('div');
  const height = slice.height();
  let paging = false;
  let pageLength;
  if (fd.page_length && fd.page_length > 0) {
    paging = true;
    pageLength = parseInt(fd.page_length, 10);
  }
  const datatable = container.find('.dataTable').DataTable({
    paging: false, // стандартный пагинатор заменен кастомным
    pageLength,
    aaSorting: [],
    searching: fd.include_search,
    bInfo: false,
    scrollY: height + 'px',
    scrollCollapse: true,
    scrollX: true,
    language: {
      search: t('Search'),
    },
  });
  fixDataTableBodyHeight(
      container.find('.dataTables_wrapper'), height);
  // Sorting table by main column
  let sortBy;
  if (fd.timeseries_limit_metric) {
    // Sort by as specified
    sortBy = fd.timeseries_limit_metric;
  } else if (metrics.length > 0) {
    // If not specified, use the first metric from the list
    sortBy = metrics[0];
  }
  if (sortBy) {
    datatable.column(data.columns.indexOf(sortBy)).order(fd.order_desc ? 'desc' : 'asc');
  }
  const originalOrder = datatable.order()[0];
  const [ originalOrderColumnIndex, originalOrderDirection ] = originalOrder || [];
  container.find('.dataTable').on('order.dt', () => {
      const [ orderColumnIndex, orderDirection ] = datatable.order()[0] || [];
      const orderColumn = data.columns[orderColumnIndex];
      if ((originalOrderColumnIndex !== orderColumnIndex) || (originalOrderDirection !== orderDirection)) {
          slice.props.exploreActions.orderBy(orderColumn, orderDirection, slice.formData.slice_id);
      }
  });
  datatable.draw();
  container.parents('.widget').find('.tooltip').remove();

  const handlePagination = (pageOffset) => {
    slice.formData.page_offset = pageOffset;
    slice.props.actions.runQuery(slice.formData, false, slice.props.timeout, slice.props.chartKey);
  };

  ReactDOM.render(
    <Pagination 
      total={payload.total_found}
      pageLength={slice.formData.page_length}
      pageOffset={payload.form_data.page_offset || slice.formData.page_offset}
      onHeightChange={height => slice.appendPaginationHeight(height)}
      onChange={handlePagination}
      slice={slice}
    />,
    paginationContainer.node()
  );

}

module.exports = tableVis;
