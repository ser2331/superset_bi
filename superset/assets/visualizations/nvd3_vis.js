// JS
import $ from 'jquery';
import throttle from 'lodash.throttle';
import d3 from 'd3';
import nv from 'nvd3';
import 'nvd3/build/nv.d3.min.css';
import mathjs from 'mathjs';
import moment from 'moment';
import d3tip from 'd3-tip';
import contextmenu from 'd3-context-menu';

import AnnotationTypes, {
  applyNativeColumns,
} from '../javascripts/modules/AnnotationTypes';
import { customizeToolTip, d3TimeFormatPreset, d3FormatPreset, tryNumify } from '../javascripts/modules/utils';
import { isTruthy } from '../javascripts/utils/common';
import { t } from '../javascripts/locales';
import { Hierarchy } from '../utils/hierarchy';
import { getColorFromScheme } from '../javascripts/modules/colors';

require('d3-context-menu/css/d3-context-menu.css');

// CSS
import './nvd3_vis.css';
import { VIZ_TYPES } from './main';

contextmenu(d3);

const minBarWidth = 15;
// Limit on how large axes margins can grow as the chart window is resized
const maxMarginPad = 30;
const animationTime = 1000;
const minHeightForBrush = 480;

const BREAKPOINTS = {
  small: 340,
};

const addTotalBarValues = function (svg, chart, data, stacked, axisFormat) {
  const format = d3.format(axisFormat || '.3s');
  const countSeriesDisplayed = data.length;

  const totalStackedValues = stacked && data.length !== 0 ?
    data[0].values.map(function (bar, iBar) {
      const bars = data.map(function (series) {
        return series.values[iBar];
      });
      return d3.sum(bars, function (d) {
        return d.y;
      });
    }) : [];

  const rectsToBeLabeled = svg.selectAll('g.nv-group').filter(
    function (d, i) {
      if (!stacked) {
        return true;
      }
      return i === countSeriesDisplayed - 1;
    }).selectAll('rect');

  const groupLabels = svg.select('g.nv-barsWrap').append('g');
  rectsToBeLabeled.each(
    function (d, index) {
      const rectObj = d3.select(this);
      if (rectObj.attr('class').includes('positive')) {
        const transformAttr = rectObj.attr('transform');
        const yPos = parseFloat(rectObj.attr('y'));
        const xPos = parseFloat(rectObj.attr('x'));
        const rectWidth = parseFloat(rectObj.attr('width'));
        const textEls = groupLabels.append('text')
          .attr('x', xPos) // rough position first, fine tune later
          .attr('y', yPos - 5)
          .text(format(stacked ? totalStackedValues[index] : d.y))
          .attr('transform', transformAttr)
          .attr('class', 'bar-chart-label');
        const labelWidth = textEls.node().getBBox().width;
        textEls.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
      }
    });
};

function hideTooltips() {
  $('.nvtooltip').css({ opacity: 0 });
}

function getMaxLabelSize(container, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const labelEls = container.find(`.${axisClass} text`).not('.nv-axislabel');
  const labelDimensions = labelEls.map(i => labelEls[i].getComputedTextLength() * 0.75);
  return Math.ceil(Math.max(...labelDimensions));
}


/**
 * Build a filter based on x axis value.
 * Comparison is strict and value is formatted as PostgreSQL timestamp.
 *
 * @param {*} columnName column name used for x axis
 * @param {number} value x value in unix time format
 * @returns {object}
 */
function getFilterForXAxis(columnName, value) {
  const sqlFormattedTimestamp = new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  return {
    op: '==',
    col: columnName,
    val: sqlFormattedTimestamp,
  };
}

export function formatLabel(input, verboseMap = {}) {
  // The input for label may be a string or an array of string
  // When using the time shift feature, the label contains a '---' in the array
  const verboseLkp = s => verboseMap[s] || s;
  let label;
  if (Array.isArray(input) && input.length) {
    const verboseLabels = input.filter(s => s !== '---').map(verboseLkp);
    label = verboseLabels.join(', ');
    if (input.length > verboseLabels.length) {
      label += ' ---';
    }
  } else {
    label = verboseLkp(input);
  }
  return label;
}

export default function nvd3Vis(slice, payload) {
  let chart;
  let colorKey = 'key';
  const isExplore = $('#explore-container').length === 1;

  let data;
  if (payload.data) {
    data = payload.data.map(x => ({
      ...x, key: formatLabel(x.key, slice.datasource.verbose_map), originalKey: x.key,
    }));
  } else {
    data = [];
  }

  slice.container.html('');
  slice.clearError();

  let width = slice.width();
  const fd = slice.formData;

  const barchartWidth = function () {
    let bars;
    if (fd.bar_stacked) {
      bars = d3.max(data, function (d) { return d.values.length; });
    } else {
      bars = d3.sum(data, function (d) { return d.values.length; });
    }
    if (bars * minBarWidth > width) {
      return bars * minBarWidth;
    }
    return width;
  };

  const vizType = fd.viz_type;
  const f = d3.format('.3s');
  const reduceXTicks = fd.reduce_x_ticks || false;
  let stacked = false;
  let row;

  const drawGraph = function () {
    let svg = d3.select(slice.selector).select('svg');
    if (svg.empty()) {
      svg = d3.select(slice.selector).append('svg');
    }
    let height = slice.height();
    const isTimeSeries = [
      'line', 'dual_line', 'area', 'compare', 'bar', 'time_pivot'].indexOf(vizType) >= 0;

    // Handling xAxis ticks settings
    let xLabelRotation = 0;
    let staggerLabels = false;
    if (fd.x_ticks_layout === 'auto') {
      if (['column', 'dist_bar'].indexOf(vizType) >= 0) {
        xLabelRotation = 45;
      } else if (isTimeSeries) {
        staggerLabels = true;
      }
    } else if (fd.x_ticks_layout === 'staggered') {
      staggerLabels = true;
    } else if (fd.x_ticks_layout === '45°') {
      if (isTruthy(fd.show_brush)) {
        const error = t('You cannot use 45° tick layout along with the time range filter');
        slice.error(error);
        return null;
      }
      xLabelRotation = 45;
    }
    const showBrush = (
      isTruthy(fd.show_brush) ||
      (fd.show_brush === 'auto' && height >= minHeightForBrush && fd.x_ticks_layout !== '45°')
    );

    switch (vizType) {
      case 'line':
        if (showBrush) {
          chart = nv.models.lineWithFocusChart();
          if (staggerLabels) {
            // Give a bit more room to focus area if X axis ticks are staggered
            chart.focus.margin({ bottom: 40 });
            chart.focusHeight(80);
          }
          chart.focus.xScale(d3.time.scale.utc());
        } else {
          chart = nv.models.lineChart();
        }
        // To alter the tooltip header
        // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        break;

      case 'time_pivot':
        chart = nv.models.lineChart();
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        break;

      case 'dual_line':
        chart = nv.models.multiChart();
        //multi chart not support this events, but we need it
        chart.dispatch = d3.dispatch('stateChange', 'renderEnd');
        chart.interpolate('linear');
        break;

      case 'bar':
        chart = nv.models.multiBarChart()
        .showControls(fd.show_controls)
        .groupSpacing(0.1);

        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        chart.xAxis
        .showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);

        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        break;

      case 'dist_bar':
        chart = nv.models.multiBarChart()
        .controlLabels({ grouped: t('grouped'), stacked: t('stacked') })
        .showControls(fd.show_controls)
        .reduceXTicks(reduceXTicks)
        .groupSpacing(0.1); // Distance between each group of bars.

        chart.xAxis.showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);
        if (fd.order_bars) {
          data.forEach((d) => {
            d.values.sort((a, b) => tryNumify(a.x) < tryNumify(b.x) ? -1 : 1);
          });
        }
        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        break;

      case 'pie':
        chart = nv.models.pieChart();
        colorKey = 'x';
        chart.valueFormat(f);
        if (fd.donut) {
          chart.donut(true);
        }
        chart.labelsOutside(fd.labels_outside);
        chart.labelThreshold(0.05);  // Configure the minimum slice size for labels to show up
        if (fd.pie_label_type !== 'key_percent' && fd.pie_label_type !== 'key_value') {
          chart.labelType(fd.pie_label_type);
        } else if (fd.pie_label_type === 'key_value') {
          chart.labelType(d => `${d.data.x}: ${d3.format('.3s')(d.data.y)}`);
        }
        chart.cornerRadius(true);

        if (fd.pie_label_type === 'percent' || fd.pie_label_type === 'key_percent') {
          let total = 0;
          data.forEach((d) => { total += d.y; });
          chart.tooltip.valueFormatter(d => `${((d / total) * 100).toFixed()}%`);
          if (fd.pie_label_type === 'key_percent') {
            chart.labelType(d => `${d.data.x}: ${((d.data.y / total) * 100).toFixed()}%`);
          }
        }

        break;

      case 'column':
        chart = nv.models.multiBarChart()
        .reduceXTicks(false);
        break;

      case 'compare':
        chart = nv.models.cumulativeLineChart();
        chart.xScale(d3.time.scale.utc());
        chart.useInteractiveGuideline(true);
        chart.xAxis.showMaxMin(false);
        break;

      case 'bubble':
        row = (col1, col2) => `<tr><td>${col1}</td><td>${col2}</td></tr>`;
        chart = nv.models.scatterChart();
        chart.showDistX(true);
        chart.showDistY(true);
        chart.tooltip.contentGenerator(function (obj) {
          const p = obj.point;
          let s = '<table>';
          s += (
            `<tr><td style="color: ${p.color};">` +
              `<strong>${p[fd.entity]}</strong> (${p.group})` +
            '</td></tr>');
          s += row(fd.x, f(p.x));
          s += row(fd.y, f(p.y));
          s += row(fd.size, f(p.size));
          s += '</table>';
          return s;
        });
        chart.pointRange([5, fd.max_bubble_size ** 2]);
        chart.pointDomain([0, d3.max(data, d => d3.max(d.values, v => v.size))]);
        break;

      case 'area':
        chart = nv.models.stackedAreaChart();
        chart.showControls(fd.show_controls);
        chart.style(fd.stacked_style);
        chart.xScale(d3.time.scale.utc());
        break;

      case 'box_plot':
        colorKey = 'label';
        chart = nv.models.boxPlotChart();
        chart.x(d => d.label);
        chart.maxBoxWidth(75); // prevent boxes from being incredibly wide
        break;

      case 'bullet':
        chart = nv.models.bulletChart();
        break;

      default:
        throw new Error('Unrecognized visualization for nvd3' + vizType);
    }

    if (chart.xAxis && chart.xAxis.staggerLabels) {
      chart.xAxis.staggerLabels(staggerLabels);
    }
    if (chart.xAxis && chart.xAxis.rotateLabels) {
      chart.xAxis.rotateLabels(xLabelRotation);
    }
    if (chart.x2Axis && chart.x2Axis.staggerLabels) {
      chart.x2Axis.staggerLabels(staggerLabels);
    }
    if (chart.x2Axis && chart.x2Axis.rotateLabels) {
      chart.x2Axis.rotateLabels(xLabelRotation);
    }

    if ('showLegend' in chart && typeof fd.show_legend !== 'undefined') {
      if (width < BREAKPOINTS.small && vizType !== 'pie') {
        chart.showLegend(false);
      } else {
        chart.showLegend(fd.show_legend);
      }
    }

    if (vizType === 'bullet') {
      height = Math.min(height, 50);
    }

    if (chart.forceY &&
        fd.y_axis_bounds &&
        (fd.y_axis_bounds[0] !== null || fd.y_axis_bounds[1] !== null)) {
      chart.forceY(fd.y_axis_bounds);
    }
    if (fd.y_log_scale) {
      chart.yScale(d3.scale.log());
    }
    if (fd.x_log_scale) {
      chart.xScale(d3.scale.log());
    }

    let xAxisFormatter = d3FormatPreset(fd.x_axis_format, fd.time_grain_sqla);
    if (isTimeSeries) {
      xAxisFormatter = d3TimeFormatPreset(fd.x_axis_format, fd.time_grain_sqla);
    }
    if (chart.x2Axis && chart.x2Axis.tickFormat) {
      chart.x2Axis.tickFormat(xAxisFormatter);
    }
    const isXAxisString = ['dist_bar', 'box_plot'].indexOf(vizType) >= 0;
    if (!isXAxisString && chart.xAxis && chart.xAxis.tickFormat) {
      chart.xAxis.tickFormat(xAxisFormatter);
    }

    const yAxisFormatter = d3FormatPreset(fd.y_axis_format, fd.time_grain_sqla);
    if (chart.yAxis && chart.yAxis.tickFormat) {
      if (fd.num_period_compare) {
        // When computing a "Period Ratio", we force a percentage format
        chart.yAxis.tickFormat(d3.format('.1%'));
      } else {
        chart.yAxis.tickFormat(yAxisFormatter);
      }
    }
    if (chart.y2Axis && chart.y2Axis.tickFormat) {
      chart.y2Axis.tickFormat(yAxisFormatter);
    }


    // Set showMaxMin for all axis
    function setAxisShowMaxMin(axis, showminmax) {
      if (axis && axis.showMaxMin && showminmax !== undefined) {
        axis.showMaxMin(showminmax);
      }
    }
    setAxisShowMaxMin(chart.xAxis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.x2Axis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.yAxis, fd.y_axis_showminmax);
    setAxisShowMaxMin(chart.y2Axis, fd.y_axis_showminmax);

    if (vizType === 'time_pivot') {
      chart.color((d) => {
        const c = fd.color_picker;
        let alpha = 1;
        if (d.rank > 0) {
          alpha = d.perc * 0.5;
        }
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
      });
    } else if (vizType !== 'bullet') {
      chart.color(d => d.color || getColorFromScheme(d[colorKey], fd.color_scheme));
    }
    if ((vizType === 'line' || vizType === 'area') && fd.rich_tooltip) {
      chart.useInteractiveGuideline(true);
      if (vizType === 'line') {
        // Custom sorted tooltip
        chart.interactiveLayer.tooltip.contentGenerator((d) => {
          let tooltip = '';
          tooltip += "<table><thead><tr><td colspan='3'>"
            + `<strong class='x-value'>${xAxisFormatter(d.value)}</strong>`
            + '</td></tr></thead><tbody>';
          d.series.sort((a, b) => a.value >= b.value ? -1 : 1);
          d.series.forEach((series) => {
            tooltip += (
              `<tr class="${series.highlight ? 'emph' : ''}">` +
                `<td class='legend-color-guide' style="opacity: ${series.highlight ? '1' : '0.75'};"">` +
                  '<div ' +
                    `style="border: 2px solid ${series.highlight ? 'black' : 'transparent'}; background-color: ${series.color};"` +
                  '></div>' +
                '</td>' +
                `<td>${series.key}</td>` +
                `<td>${yAxisFormatter(series.value)}</td>` +
              '</tr>'
            );
          });
          tooltip += '</tbody></table>';
          return tooltip;
        });
      }
    }

    if (vizType === 'dual_line') {
      const yAxisFormatter1 = d3.format(fd.y_axis_format);
      const yAxisFormatter2 = d3.format(fd.y_axis_2_format);
      chart.yAxis1.tickFormat(yAxisFormatter1);
      chart.yAxis2.tickFormat(yAxisFormatter2);
      customizeToolTip(chart, xAxisFormatter, [yAxisFormatter1, yAxisFormatter2]);
      chart.showLegend(width > BREAKPOINTS.small);
    }
    chart.height(height);
    slice.container.css('height', height + 'px');

    svg
    .datum(data)
    .transition().duration(500)
    .attr('height', height)
    .attr('width', width)
    .call(chart);

    if (fd.show_markers) {
      svg.selectAll('.nv-point')
      .style('stroke-opacity', 1)
      .style('fill-opacity', 1);
    }

    if (chart.yAxis !== undefined || chart.yAxis2 !== undefined) {
      // Hack to adjust y axis left margin to accommodate long numbers
      const containerWidth = slice.container.width();
      const marginPad = Math.ceil(
        Math.min(isExplore ? containerWidth * 0.01 : containerWidth * 0.03, maxMarginPad),
      );
      const maxYAxisLabelWidth = chart.yAxis2 ? getMaxLabelSize(slice.container, 'nv-y1')
                                              : getMaxLabelSize(slice.container, 'nv-y');
      const maxXAxisLabelHeight = getMaxLabelSize(slice.container, 'nv-x');
      chart.margin({ left: maxYAxisLabelWidth + marginPad });
      if (fd.y_axis_label && fd.y_axis_label !== '') {
        chart.margin({ left: maxYAxisLabelWidth + marginPad + 25 });
      }
      // Hack to adjust margins to accommodate long axis tick labels.
      // - has to be done only after the chart has been rendered once
      // - measure the width or height of the labels
      // ---- (x axis labels are rotated 45 degrees so we use height),
      // - adjust margins based on these measures and render again
      const margins = chart.margin();
      margins.bottom = 28;
      if (fd.x_axis_showminmax) {
        // If x bounds are shown, we need a right margin
        margins.right = Math.max(20, maxXAxisLabelHeight / 2) + marginPad;
      }
      if (xLabelRotation === 45) {
        margins.bottom = maxXAxisLabelHeight + marginPad;
        margins.right = maxXAxisLabelHeight + marginPad;
      } else if (staggerLabels) {
        margins.bottom = 40;
      }

      if (vizType === 'dual_line') {
        const maxYAxis2LabelWidth = getMaxLabelSize(slice.container, 'nv-y2');
        // use y axis width if it's wider than axis width/height
        if (maxYAxis2LabelWidth > maxXAxisLabelHeight) {
          margins.right = maxYAxis2LabelWidth + marginPad;
        }
      }
      if (fd.bottom_margin && fd.bottom_margin !== 'auto') {
        margins.bottom = parseInt(fd.bottom_margin, 10);
      }
      if (fd.left_margin && fd.left_margin !== 'auto') {
        margins.left = fd.left_margin;
      }

      if (fd.x_axis_label && fd.x_axis_label !== '' && chart.xAxis) {
        margins.bottom += 25;
        let distance = 0;
        if (margins.bottom && !isNaN(margins.bottom)) {
          distance = margins.bottom - 45;
        }
        // nvd3 bug axisLabelDistance is disregarded on xAxis
        // https://github.com/krispo/angular-nvd3/issues/90
        chart.xAxis.axisLabel(fd.x_axis_label).axisLabelDistance(distance);
      }

      if (fd.y_axis_label && fd.y_axis_label !== '' && chart.yAxis) {
        let distance = 0;
        if (margins.left && !isNaN(margins.left)) {
          distance = margins.left - 70;
        }
        chart.yAxis.axisLabel(fd.y_axis_label).axisLabelDistance(distance);
      }

      const annotationLayers = (slice.formData.annotation_layers || []).filter(x => x.show);
      if (isTimeSeries && annotationLayers && slice.annotationData) {
        // Time series annotations add additional data
        const timeSeriesAnnotations = annotationLayers
          .filter(a => a.annotationType === AnnotationTypes.TIME_SERIES).reduce((bushel, a) =>
        bushel.concat((slice.annotationData[a.name] || []).map((series) => {
          if (!series) {
            return {};
          }
          const key = Array.isArray(series.key) ?
            `${a.name}, ${series.key.join(', ')}` : `${a.name}, ${series.key}`;
          return {
            ...series,
            key,
            color: a.color,
            strokeWidth: a.width,
            classed: `${a.opacity} ${a.style}`,
          };
        })), []);
        data.push(...timeSeriesAnnotations);
      }

      // render chart
      svg
      .datum(data)
      .transition().duration(500)
      .attr('height', height)
      .attr('width', width)
      .call(chart);

      // on scroll, hide tooltips. throttle to only 4x/second.
      $(window).scroll(throttle(hideTooltips, 250));

      // The below code should be run AFTER rendering because chart is updated in call()
      if (isTimeSeries && annotationLayers) {
        // Formula annotations
        const formulas = annotationLayers.filter(a => a.annotationType === AnnotationTypes.FORMULA)
          .map(a => ({ ...a, formula: mathjs.parse(a.value) }));

        let xMax;
        let xMin;
        let xScale;
        if (vizType === VIZ_TYPES.bar) {
          xMin = d3.min(data[0].values, d => (d.x));
          xMax = d3.max(data[0].values, d => (d.x));
          xScale = d3.scale.quantile()
            .domain([xMin, xMax])
            .range(chart.xAxis.range());
        } else {
          xMin = chart.xAxis.scale().domain()[0].valueOf();
          xMax = chart.xAxis.scale().domain()[1].valueOf();
          xScale = chart.xScale ? chart.xScale() : d3.scale.linear();
        }

        // TODO: Почему clamp может не быть? Падает на ресайзе filter box
        if (xScale.clamp) {
            xScale.clamp(true);
        }

        if (Array.isArray(formulas) && formulas.length) {
          const xValues = [];
          if (vizType === VIZ_TYPES.bar) {
            // For bar-charts we want one data point evaluated for every
            // data point that will be displayed.
            const distinct = data.reduce((xVals, d) => {
              d.values.forEach(x => xVals.add(x.x));
              return xVals;
            }, new Set());
            xValues.push(...distinct.values());
            xValues.sort();
          } else {
            // For every other time visualization it should be ok, to have a
            // data points in even intervals.
            let period = Math.min(...data.map(d =>
              Math.min(...d.values.slice(1).map((v, i) => v.x - d.values[i].x))));
            const dataPoints = (xMax - xMin) / (period || 1);
            // make sure that there are enough data points and not too many
            period = dataPoints < 100 ? (xMax - xMin) / 100 : period;
            period = dataPoints > 500 ? (xMax - xMin) / 500 : period;
            xValues.push(xMin);
            for (let x = xMin; x < xMax; x += period) {
              xValues.push(x);
            }
            xValues.push(xMax);
          }
          const formulaData = formulas.map(fo => ({
            key: fo.name,
            values: xValues.map((x => ({ y: fo.formula.eval({ x }), x }))),
            color: fo.color,
            strokeWidth: fo.width,
            classed: `${fo.opacity} ${fo.style}`,
          }));
          data.push(...formulaData);
        }
        const xAxis = chart.xAxis1 ? chart.xAxis1 : chart.xAxis;
        const yAxis = chart.yAxis1 ? chart.yAxis1 : chart.yAxis;
        const chartWidth = xAxis.scale().range()[1];
        const annotationHeight = yAxis.scale().range()[0];
        const tipFactory = layer => d3tip()
          .attr('class', 'd3-tip')
          .direction('n')
          .offset([-5, 0])
          .html((d) => {
            if (!d) {
              return '';
            }
            const title = d[layer.titleColumn] && d[layer.titleColumn].length ?
              d[layer.titleColumn] + ' - ' + layer.name :
              layer.name;
            const body = Array.isArray(layer.descriptionColumns) ?
              layer.descriptionColumns.map(c => d[c]) : Object.values(d);
            return '<div><strong>' + title + '</strong></div><br/>' +
              '<div>' + body.join(', ') + '</div>';
          });

        if (slice.annotationData) {
          // Event annotations
          annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.EVENT &&
            slice.annotationData && slice.annotationData[x.name]
          )).forEach((config, index) => {
            const e = applyNativeColumns(config);
            // Add event annotation layer
            const annotations = d3.select(slice.selector).select('.nv-wrap').append('g')
              .attr('class', `nv-event-annotation-layer-${index}`);
            const aColor = e.color || getColorFromScheme(e.name, fd.color_scheme);

            const tip = tipFactory(e);
            const records = (slice.annotationData[e.name].records || []).map((r) => {
              const timeValue = new Date(moment.utc(r[e.timeColumn]));

              return {
                ...r,
                [e.timeColumn]: timeValue,
              };
            }).filter(record => !Number.isNaN(record[e.timeColumn].getMilliseconds()));

            if (records.length) {
              annotations.selectAll('line')
                .data(records)
                .enter()
                .append('line')
                .attr({
                  x1: d => xScale(new Date(d[e.timeColumn])),
                  y1: 0,
                  x2: d => xScale(new Date(d[e.timeColumn])),
                  y2: annotationHeight,
                })
                .attr('class', `${e.opacity} ${e.style}`)
                .style('stroke', aColor)
                .style('stroke-width', e.width)
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide)
                .call(tip);
            }

            // update annotation positions on brush event
            chart.focus.dispatch.on('onBrush.event-annotation', function () {
              annotations.selectAll('line')
                .data(records)
                .attr({
                  x1: d => xScale(new Date(d[e.timeColumn])),
                  y1: 0,
                  x2: d => xScale(new Date(d[e.timeColumn])),
                  y2: annotationHeight,
                  opacity: (d) => {
                    const x = xScale(new Date(d[e.timeColumn]));
                    return (x > 0) && (x < chartWidth) ? 1 : 0;
                  },
                });
            });
          });

          // Interval annotations
          annotationLayers.filter(x => (
            x.annotationType === AnnotationTypes.INTERVAL &&
            slice.annotationData && slice.annotationData[x.name]
          )).forEach((config, index) => {
            const e = applyNativeColumns(config);
            // Add interval annotation layer
            const annotations = d3.select(slice.selector).select('.nv-wrap').append('g')
              .attr('class', `nv-interval-annotation-layer-${index}`);

            const aColor = e.color || getColorFromScheme(e.name, fd.color_scheme);
            const tip = tipFactory(e);

            const records = (slice.annotationData[e.name].records || []).map((r) => {
              const timeValue = new Date(moment.utc(r[e.timeColumn]));
              const intervalEndValue = new Date(moment.utc(r[e.intervalEndColumn]));
              return {
                ...r,
                [e.timeColumn]: timeValue,
                [e.intervalEndColumn]: intervalEndValue,
              };
            }).filter(record => (
              !Number.isNaN(record[e.timeColumn].getMilliseconds()) &&
              !Number.isNaN(record[e.intervalEndColumn].getMilliseconds())
            ));

            if (records.length) {
              annotations.selectAll('rect')
                .data(records)
                .enter()
                .append('rect')
                .attr({
                  x: d => Math.min(xScale(new Date(d[e.timeColumn])),
                    xScale(new Date(d[e.intervalEndColumn]))),
                  y: 0,
                  width: d => Math.max(Math.abs(xScale(new Date(d[e.intervalEndColumn])) -
                    xScale(new Date(d[e.timeColumn]))), 1),
                  height: annotationHeight,
                })
                .attr('class', `${e.opacity} ${e.style}`)
                .style('stroke-width', e.width)
                .style('stroke', aColor)
                .style('fill', aColor)
                .style('fill-opacity', 0.2)
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide)
                .call(tip);
            }

            // update annotation positions on brush event
            chart.focus.dispatch.on('onBrush.interval-annotation', function () {
              annotations.selectAll('rect')
                .data(records)
                .attr({
                  x: d => xScale(new Date(d[e.timeColumn])),
                  width: (d) => {
                    const x1 = xScale(new Date(d[e.timeColumn]));
                    const x2 = xScale(new Date(d[e.intervalEndColumn]));
                    return x2 - x1;
                  },
                });
            });
          });
        }
      }
    }
    return chart;
  };

  // hide tooltips before rendering chart, if the chart is being re-rendered sometimes
  // there are left over tooltips in the dom,
  // this will clear them before rendering the chart again.
  hideTooltips();

  const getAppropriateDataKey = (dataKey) => {
    const str = Array.isArray(dataKey) ? dataKey.join(', ') : dataKey;
    const payloadData = payload && payload.data || [];
    const { key: result } = payloadData.find(({ key }) => (Array.isArray(key) ? key.join(', ') : key) === str) || { key: [] };
    return Array.isArray(result) ? result : [result];
  };

  const contextMenu = (data) => {
    const breakdownColumns = slice.formData.columns;
    const sliceColumns = slice.formData.groupby;
    let contextColumns;
    let contextBreakdownColumns = [];
    const contextFilters = [];
    const dataKey = (data.originalKey || data.key);
    const dataKeyArray = getAppropriateDataKey(dataKey);
    switch (slice.formData.viz_type) {
      case 'pie':
        contextColumns = data.data.x;
        break;
      case 'line': {
        contextColumns = dataKeyArray;
        const xAxisName = slice.formData.granularity_sqla;
        const xAxisValue = d3.event.target.__data__[0].x;
        contextFilters.push(getFilterForXAxis(xAxisName, xAxisValue));
        break;
      }
      default:
        contextColumns = data.x;
        contextBreakdownColumns = dataKeyArray;
    }
    contextColumns.forEach((column, index) => {
        const filter = { col: sliceColumns[index], val: column.trim() };
        contextFilters.push(filter);
    });
    contextBreakdownColumns.forEach((column, index) => {
        const filter = { col: breakdownColumns[index], val: column.trim() };
        contextFilters.push(filter);
    });
    const hierarcyManager = new Hierarchy(slice, payload);
    const urlDrilldowns = hierarcyManager.getUrlDrilldowns(slice.formData.metrics[0], contextFilters);

    const hierarchyDrilldowns = [];

    payload.hierarchy.forEach((h) => {
      if (slice.formData.disabled_hierarchy.findIndex(dh => dh === h.id) !== -1) {
        return;
      }

      const currentHierarchyDrilldown = [];
      const mapColumnToDrilldown = (hierarchyColumn) => {
          const drilldown = {
              id: hierarchyColumn.id,
              order: hierarchyColumn.order,
              title: hierarchyColumn.verbose_name || hierarchyColumn.name,
              action: () => {
                let hierarchyContextColumns;
                let hierarchyContextBreakdownColumns = [];
                switch (slice.formData.viz_type) {
                  case 'pie':
                    hierarchyContextColumns = data.data.x;
                    break;
                  case 'line':
                    hierarchyContextColumns = dataKeyArray;
                    break;
                  default:
                    hierarchyContextColumns = data.x;
                    hierarchyContextBreakdownColumns = dataKeyArray;
                    break;
                }
                const hierarchyContextFilters = [];
                hierarchyContextColumns.filter(column => contextColumns.includes(column)).forEach((column, index) => {
                    const filter = { col: sliceColumns[index], op: 'in', val: [column.trim()] };
                    hierarchyContextFilters.push(filter);
                });
                hierarchyContextBreakdownColumns.filter(column => contextColumns.includes(column)).forEach((column, index) => {
                    const filter = { col: breakdownColumns[index], op: 'in', val: [column.trim()] };
                    hierarchyContextFilters.push(filter);
                });
                hierarcyManager.drilldownToHierarchy(hierarchyColumn, hierarchyContextFilters);
              },
          };
          return drilldown;
      };

      // Если нет столбцов для группировки, берется столбец с самым маленьким order
      if (!slice.formData.groupby.length && h.columns[0]) {
          const nextColumn = hierarcyManager.getNextColumnByHierarchy(h, h.columns[0]);
          if (nextColumn) {
              currentHierarchyDrilldown.push(mapColumnToDrilldown(nextColumn));
          }
      } else { // Если есть, для каждого ищется следующий по иерархии
          const nextColumns = h.columns
              .filter(hierarchyColumn => slice.formData.groupby.includes(hierarchyColumn.name))
              .map(hierarchyColumn => hierarcyManager.getNextColumnByHierarchy(h, hierarchyColumn))
              .filter(item => item);
          nextColumns // Если найденный следующий уже присутствует в группировке - его не предлагать
              .filter(item => !slice.formData.groupby.includes(item.name))
              .forEach((item) => {
                  currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
              });
      }

      if (currentHierarchyDrilldown.length) {
        hierarchyDrilldowns.push({ title: h.verbose_name || h.name });
        currentHierarchyDrilldown.forEach((item) => {
            hierarchyDrilldowns.push(item);
        });
      }
    });

    const menuItems = [ ...hierarchyDrilldowns, ...urlDrilldowns ];
    return menuItems;
  };

  nv.addGraph(drawGraph, function (resultChart) {
    let selector = slice.formData.viz_type;
    if (slice.formData.viz_type === 'dist_bar') selector = '.nv-bar';
    if (slice.formData.viz_type === 'pie') selector = '.nv-pie > .nv-slice';

    const fixMenuPosition = () => {
      // fix menu position to prevent going righter screen
      const d3menu = d3.select('.d3-context-menu');
      const widthStr = d3menu.style('width');
      const widthNum = parseInt(widthStr.substring(0, widthStr.length - 2), 10);
      if (d3.event.x  + widthNum > window.innerWidth - 20) {
        d3menu.style('left', 'auto');
        d3menu.style('right', 0);
      }
    };
    const applyContextMenuForLines = () => {
      d3.selectAll(`#${slice.containerId} .nv-focus > .nv-series, #${slice.containerId} .nv-group`)
        .style('pointer-events', 'all')
        .on('contextmenu', (event) => {
          const items = contextMenu(event);
          if (items.length) {
            d3.contextMenu(() => items)();
            fixMenuPosition();
          }
        });
    };
    if (slice.formData.viz_type === 'line') {
        selector = '.nv-legend .nv-series';
    }
    const applyContextMenu = () => {
      d3.selectAll(`#${slice.containerId} ${selector}`).on('contextmenu', (event) => {
        const items = contextMenu(event);
        if (items.length) {
            d3.contextMenu(() => items)();
            fixMenuPosition();
        }
      });
    };
    const monkeyPatchRescaleLabel = () => {
        if (slice.formData.viz_type === 'compare') {
          d3.select('.nv-controlsWrap text')
            .select(function() {
              if (this.innerHTML === 'Re-scale y-axis' || this.getAttribute('t-key') === 'Re-scale y-axis') {
                this.setAttribute('t-key', 'Re-scale y-axis');
                this.innerHTML = t('Re-scale y-axis');
              }
              return this;
            });
        }
    };

    monkeyPatchRescaleLabel();
    const originalUpdate = resultChart.update;
    chart.dispatch.on('stateChange', () => {
      // TODO: stateChange последнее торчащее событие (есть еще changeState, вроде то же самое, но не из легенды),
      // после него вызывается chart.update() - непонятно, бросает ли он событие; renderEnd для тоггла легенды не вызывается;
      // прибег к monkeypatching'у метода update.
      resultChart.update = () => {
        originalUpdate();
        monkeyPatchRescaleLabel();
      };
    });
    chart.dispatch.on('renderEnd', (e) => {
        if (slice.formData.viz_type === 'line') {
          applyContextMenuForLines();
        }
        applyContextMenu();

        
    });
  });
}
