// JS
import $ from "jquery";
import throttle from "lodash.throttle";
import d3 from "d3";
import nv from "nvd3";
import "nvd3/build/nv.d3.min.css";
import mathjs from "mathjs";
import moment from "moment";
import d3tip from "d3-tip";
import contextmenu from "d3-context-menu";
import md5 from "blueimp-md5";
import AnnotationTypes, { applyNativeColumns } from "../javascripts/modules/AnnotationTypes";
import {
  customizeToolTip,
  d3FormatPreset,
  d3TimeFormatPreset,
  d3format,
  tryNumify
} from "../javascripts/modules/utils";
import { isTruthy, getAggregateTranslateLabel } from "../javascripts/utils/common";
import { t } from "../javascripts/locales";
import { Hierarchy } from "../utils/hierarchy";
import { contextMenuEnabled } from "../utils/context_menu";
import { getColorFromScheme } from "../javascripts/modules/colors";
// CSS
import "./nvd3_vis.css";
import VIZ_TYPES from "./viz_types";
import { getValidationErrorsPositions } from "../javascripts/explore/validators";
import { checkVizTypeDDLines, nvd3DDVisualization } from "./helpers/ddVisualization/nvd3VisDD";
import { checkDDHierarchyExist } from "./helpers/ddVisualization/helpers/checkDDShowMenu";
import { rerenderBigLegend } from "./helpers/ddVisualization/helpers/rerenderBigLegend";
import {
  collapseLegendNamesPie, refactorPosition, refactorPositionPie,
  sliceLegendNamesPie,
  sliceNamesPie, splitLabelIntoMultipleLines
} from "./helpers/ddVisualization/helpers/sliceLegendNamesPie.js";

import "./helpers/ddVisualization/DDVisualization.scss";

const LEGEND_MAX_KEY_LENGTH = 1000;

import "d3-context-menu/css/d3-context-menu.css";

const AGGREGATES_TO_RUSSIA = {
  "Уникальных значений": "COUNT_DISTINCT",
  "Число строк": "COUNT",
  "Максимум": "MAX",
  "Минимум": "MIN",
  "Среднее значение": "AVG",
  "Сумма": "SUM"
};
const collapseLegendCharts = new Set(["pie", "dist_bar", "bar", "line"]);

const getAggregateTranslateValue = (value) => {
  if(value) {
    let res = "";
    let matchStr = value.match(/^([^(])+/);
    let endStr = value.match(/\((.*)$/);

    if(matchStr?.length && endStr?.length) {
      Object.keys(AGGREGATES_TO_RUSSIA).forEach((el) => {
        if(matchStr[0] === el) {
          res = res + AGGREGATES_TO_RUSSIA[el] + endStr[0];
        }
      });
    }
    return res || value;
  }
};

const { line, pie, bullet, bar, dist_bar, dual_line, area, compare, time_pivot, box_plot, column, bubble } = VIZ_TYPES;

contextmenu(d3);

const minBarWidth = 15;
// Limit on how large axes margins can grow as the chart window is resized
const maxMarginPad = 30;
const animationTime = 1000;
const minHeightForBrush = 480;

const BREAKPOINTS = {
  small: 340
};

const addTotalBarValues = function(svg, chart, data, stacked, axisFormat) {
  const format = d3.format(axisFormat || ".3s");
  const countSeriesDisplayed = data.length;

  const totalStackedValues =
    stacked && data.length !== 0
      ? data[0].values.map(function(bar, iBar) {
        const bars = data.map(function(series) {
          return series.values[iBar];
        });
        return d3.sum(bars, function(d) {
          return d.y;
        });
      })
      : [];

  const rectsToBeLabeled = svg
    .selectAll("g.nv-group")
    .filter(function(d, i) {
      if(!stacked) {
        return true;
      }
      return i === countSeriesDisplayed - 1;
    })
    .selectAll("rect");

  const groupLabels = svg.select("g.nv-barsWrap").append("g");
  rectsToBeLabeled.each(function(d, index) {
    const rectObj = d3.select(this);
    if(rectObj.attr("class").includes("positive")) {
      const transformAttr = rectObj.attr("transform");
      const yPos = parseFloat(rectObj.attr("y"));
      const xPos = parseFloat(rectObj.attr("x"));
      const rectWidth = parseFloat(rectObj.attr("width"));
      const textEls = groupLabels
        .append("text")
        .attr("x", xPos) // rough position first, fine tune later
        .attr("y", yPos - 5)
        .text(format(stacked ? totalStackedValues[index] : d.y))
        .attr("transform", transformAttr)
        .attr("class", "bar-chart-label");
      const labelWidth = textEls?.node()?.getBBox()?.width || 0;
      textEls.attr("x", xPos + rectWidth / 2 - labelWidth / 2); // fine tune
    }
  });
};

function hideTooltips() {
  $(".nvtooltip").css({ opacity: 0 });
}

function getMaxLabelSize(container, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const labelEls = container.find(`.${axisClass} text`).not(".nv-axislabel");
  const labelDimensions = labelEls.map((i) => labelEls[i].getComputedTextLength() * 0.75);
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
function getFiltersForXAxis(columnName, value, duration = null, isComulativeTotal) {
  const from = value;
  let to = null;
  if(isComulativeTotal) {
    if(duration) {
      to = moment.utc(from).add(moment.duration(duration));
      return [
        {
          op: "<",
          col: columnName,
          val: to
        }
      ];
    }
    return {
      op: "<=",
      col: columnName,
      val: from
    };
  }
  if(duration) {
    to = moment.utc(from).add(moment.duration(duration));

    return [
      {
        op: ">=",
        col: columnName,
        val: moment.utc(from).format("YYYY-MM-DD HH:mm:ss")
      },
      {
        op: "<",
        col: columnName,
        val: moment.utc(to).format("YYYY-MM-DD HH:mm:ss")
      }
    ];
  }
  return {
    op: "==",
    col: columnName,
    val: from
  };
}

export function formatLabel(input, verboseMap = {}, vizType) {
  // The input for label may be a string or an array of string
  // When using the time shift feature, the label contains a '---' in the array
  const verboseLkp = (s) => verboseMap[s] || s;
  let label;
  if(Array.isArray(input) && input.length) {
    const verboseLabels = input.filter((s) => s !== "---").map(verboseLkp);
    label = verboseLabels.join(", ");
    if(input.length > verboseLabels.length) {
      label += " ---";
    }
  } else {
    label = verboseLkp(input);
  }

  if(vizType === "bar") {
    label = getAggregateTranslateLabel(label);
  }

  return label;
}

const lettersSetToBuildLineChart = ["l", "q", "c", "s", "h", "v", "a", "z", "m", "t"];

const getCoordsForLineInterpolation = (parsedPathArray) =>
  parsedPathArray.filter((element) => element !== "," && !lettersSetToBuildLineChart.includes(element.toLowerCase()));

const makeLinePathReadable = (path) => {
  let result = "";
  let comma = 0;
  for(let symbol of path) {
    if(symbol === ",") {
      if(comma === 0) {
        comma = 1;
        result = result + ",";
      } else {
        comma = 0;
        result = result + " , ";
      }
    } else if(lettersSetToBuildLineChart.includes(symbol.toLowerCase())) {
      comma = 0;
      result = result + ` ${symbol} `;
    } else {
      result = result + symbol;
    }
  }
  return result;
};

const getXOnTheLine = (sectionY, lineXFrom, lineXTo, lineYFrom, lineYTo, a) => {
  const lineYDiff = lineYTo - lineYFrom || 0.1;
  return ((sectionY - lineYFrom) * (lineXTo - lineXFrom)) / lineYDiff + lineXFrom;
};

const getValueYForConditionalFormattingLine = (setValue, minMaxValuesY, backgroundRectHeight, percentageRange) => {
  const setValuePercent = ((setValue - minMaxValuesY.min) * 100) / (minMaxValuesY.max - minMaxValuesY.min);
  const value = percentageRange ? setValue : setValuePercent;

  return backgroundRectHeight - (value * backgroundRectHeight) / 100;
};

const fillСoloredPathesToRender = (
  coordsArrays,
  conditionalFormattingSectionsForColorPathes,
  coloredPathesToRender
) => {
  coordsArrays.map((coordsArray) => {
    coordsArray.forEach((element, index, arr) => {
      if(!element || !element.length) {
        return;
      }
      const point1 = element.split(",");
      if(!point1.length) {
        return;
      }
      let lineXFrom = Number(point1[0]);
      let lineYFrom = Number(point1[1]);
      if(isNaN(lineXFrom)) {
        lineXFrom = Number(point1[0].substring(1));
      }
      if(isNaN(lineYFrom)) {
        lineYFrom = Number(point1[1].substring(1));
      }
      const point2 = arr[index + 1] ? arr[index + 1].split(",") : [];
      if(!point2.length) {
        return;
      }
      let lineXTo = Number(point2[0]);
      let lineYTo = Number(point2[1]);
      if(isNaN(lineXTo)) {
        lineXTo = Number(point2[0].substring(1));
      }
      if(isNaN(lineYTo)) {
        lineYTo = Number(point2[1].substring(1));
      }

      // always direction: top -> bottom (e.g. 100px = lineYFrom and placed heigher, 200px = lineYTo)
      if(lineYFrom > lineYTo) {
        const lineXFromTepmrory = lineXFrom;
        const lineYFromTepmrory = lineYFrom;
        lineXFrom = lineXTo;
        lineXTo = lineXFromTepmrory;
        lineYFrom = lineYTo;
        lineYTo = lineYFromTepmrory;
      }
      conditionalFormattingSectionsForColorPathes.forEach((section) => {
        const { valueYFrom: sectionYTo, valueYTo: sectionYFrom, color } = section;
        // cause bottom value in section is placed heigher than top value - 0,0px is from top to bottom in chart - unlike section values
        // always direction: setValues: 100 -> 200, in px on chart: 800px -> 900px
        const coloredPath = {
          stroke: color
        };
        // case when this length is placed in the section completely
        if(lineYFrom >= sectionYFrom && lineYTo <= sectionYTo) {
          coloredPath.d = `M${lineXFrom},${lineYFrom},${lineXTo},${lineYTo}`;
        }
        // case when part of the length is placed on top of the section
        if(lineYFrom < sectionYFrom && lineYTo >= sectionYFrom && lineYTo <= sectionYTo) {
          const newLineXFrom = getXOnTheLine(sectionYFrom, lineXFrom, lineXTo, lineYFrom, lineYTo);
          coloredPath.d = `M${newLineXFrom},${sectionYFrom},${lineXTo},${lineYTo}`;
        }
        // case when part of the length is placed below the section
        if(lineYFrom >= sectionYFrom && lineYFrom <= sectionYTo && lineYTo >= sectionYTo) {
          const newLineXTo = getXOnTheLine(sectionYTo, lineXFrom, lineXTo, lineYFrom, lineYTo, true);
          coloredPath.d = `M${lineXFrom},${lineYFrom},${newLineXTo},${sectionYTo}`;
          coloredPathesToRender.push(coloredPath);
        }
        // case when the length is placed beyond the section in both directions
        if(lineYFrom < sectionYFrom && lineYTo > sectionYTo) {
          const newLineXFrom = getXOnTheLine(sectionYFrom, lineXFrom, lineXTo, lineYFrom, lineYTo);
          const newLineXTo = getXOnTheLine(sectionYTo, lineXFrom, lineXTo, lineYFrom, lineYTo);
          coloredPath.d = `M${newLineXFrom},${sectionYFrom},${newLineXTo},${sectionYTo}`;
        }
        if(coloredPath.d) {
          coloredPathesToRender.push(coloredPath);
        }
      });
    });
  });
};

const getConditionalFormattingSectionsForColorPathes = (
  conditional_formatting,
  minMaxLineChartValuesY,
  backgroundRectHeight,
  percentageRange
) =>
  conditional_formatting.map(({ color, from, to }) => {
    const valueYFrom = getValueYForConditionalFormattingLine(
      Number(from),
      minMaxLineChartValuesY,
      backgroundRectHeight,
      percentageRange
    );
    const valueYTo = getValueYForConditionalFormattingLine(
      Number(to),
      minMaxLineChartValuesY,
      backgroundRectHeight,
      percentageRange
    );
    return {
      color: `rgb(${color.r}, ${color.g}, ${color.b})`,
      valueYFrom,
      valueYTo
    };
  });

const renderConditionalFormattingLabelsDecorator = (showLabels, backgroundRectWidth, conditional_formatting) => {
  const transformX = showLabels.includes("left") ? 0 : backgroundRectWidth;
  const textAnchor = showLabels.includes("left") ? "start" : "end";
  const dx = showLabels.includes("left") ? "5" : "-5";
  const minFrom = conditional_formatting[0].from;
  const maxTo = conditional_formatting[conditional_formatting.length - 1].to;
  return (labelDown, labelUp, setFrom, setTo, valueYFrom, valueYTo, formattingLabelsWrapper) => {
    const shouldRenderLabelDown =
      labelDown &&
      ((showLabels.includes("show_limit") && Number(minFrom) === Number(setFrom)) ||
        !showLabels.includes("show_limit"));
    const shouldRenderLabelUp =
      labelUp &&
      ((showLabels.includes("show_limit") && Number(maxTo) === Number(setTo)) || !showLabels.includes("show_limit"));
    if(shouldRenderLabelDown && valueYFrom > 0) {
      formattingLabelsWrapper
        .append("text")
        .attr("style", `text-anchor: ${textAnchor}; font: bold 10px Arial,sans-serif;`)
        .attr("dx", dx)
        .attr("y", "-5")
        .attr("transform", `translate(${transformX}, ${valueYFrom})`)
        .html(labelDown);
    }

    if(shouldRenderLabelUp && valueYTo >= 0) {
      formattingLabelsWrapper
        .append("text")
        .attr("style", `text-anchor: ${textAnchor}; font: bold 10px Arial, sans-serif;`)
        .attr("dx", dx)
        .attr("y", "11")
        .attr("transform", `translate(${transformX}, ${valueYTo})`)
        .html(labelUp);
    }
  };
};
export const getMinMaxLineChartValuesY = (data) =>
  data?.reduce(
    (acc, value) => {
      const min = d3.min(value.values ? value.values : value, (d) => d.y);
      const max = d3.max(value.values ? value.values : value, (d) => d.y);
      return {
        min: acc.min === null ? min : acc.min > min ? min : acc.min,
        max: acc.max === null ? max : acc.max < max ? max : acc.max
      };
    },
    { min: null, max: null }
  );

const renderConditionalFormattingLinesAndLabels = (
  lineChartWrapper,
  conditional_formatting,
  showLabels,
  minMaxLineChartValuesY,
  percentageRange
) => {
  const lineChartBackgroundRect = lineChartWrapper.select(".nv-background > rect");
  const { width: backgroundRectWidth, height: backgroundRectHeight } = lineChartBackgroundRect?.node()?.getBBox() || {
    width: 0,
    height: 0
  };
  const formattingLinesWrapper = lineChartWrapper
    .append("g")
    .attr("class", `custom-nv-avgLinesWrap`)
    .style("pointer-events", "none");

  formattingLinesWrapper
    .append("line")
    .attr("style", `stroke-width: 1; stroke: white; stroke-opacity: 0`)
    .attr("x1", "0")
    .attr("x2", backgroundRectWidth)
    .attr("y1", "0")
    .attr("y2", "0");

  formattingLinesWrapper
    .append("line")
    .attr("style", `stroke-width: 1; stroke: white; stroke-opacity: 0`)
    .attr("x1", "0")
    .attr("x2", backgroundRectWidth)
    .attr("y1", backgroundRectHeight)
    .attr("y2", backgroundRectHeight);

  const formattingLabelsWrapper = formattingLinesWrapper
    .append("g")
    .attr("class", `custom-nv-LabelsWrap`)
    .style("pointer-events", "none");

  const renderLabels = renderConditionalFormattingLabelsDecorator(
    showLabels,
    backgroundRectWidth,
    conditional_formatting
  );
  conditional_formatting.forEach((sector) => {
    const valueYFrom = getValueYForConditionalFormattingLine(
      Number(sector.from),
      minMaxLineChartValuesY,
      backgroundRectHeight,
      percentageRange
    );
    const valueYTo = getValueYForConditionalFormattingLine(
      Number(sector.to),
      minMaxLineChartValuesY,
      backgroundRectHeight,
      percentageRange
    );

    // count px value from top to bottom
    // maxValuePXTorender - 0 e.g.
    // minValuePXTorender - 434 e.g.
    const minMaxLineChartValuesYMin = percentageRange ? 0 : minMaxLineChartValuesY.min;
    const maxValueYPXRender = getValueYForConditionalFormattingLine(
      minMaxLineChartValuesYMin,
      minMaxLineChartValuesY,
      backgroundRectHeight,
      percentageRange
    );

    const updatedValueYFrom = valueYFrom > maxValueYPXRender ? maxValueYPXRender : valueYFrom;
    formattingLinesWrapper
      .append("line")
      .attr(
        "style",
        `stroke-width: 2; stroke-dasharray: 10, 10; stroke: rgb(${sector.color.r}, ${sector.color.g}, ${sector.color.b}); stroke-opacity: 1`
      )
      .attr("x1", "0")
      .attr("x2", backgroundRectWidth)
      .attr("y1", updatedValueYFrom)
      .attr("y2", updatedValueYFrom);

    const updatedValueYTo = valueYTo < 0 ? 0 : valueYTo;
    formattingLinesWrapper
      .append("line")
      .attr(
        "style",
        `stroke-width: 2; stroke-dasharray: 10, 10; stroke: rgb(${sector.color.r}, ${sector.color.g}, ${sector.color.b}); stroke-opacity: 1`
      )
      .attr("x1", "0")
      .attr("x2", backgroundRectWidth)
      .attr("y1", updatedValueYTo)
      .attr("y2", updatedValueYTo);

    if(showLabels !== "no_show") {
      renderLabels(
        sector.labelDown,
        sector.labelUp,
        sector.from,
        sector.to,
        updatedValueYFrom,
        updatedValueYTo,
        formattingLabelsWrapper
      );
    }
  });
};
const renderLinesWithinTheRanges = (
  lineChartWrapper,
  conditional_formatting,
  minMaxLineChartValuesY,
  labelColorsIndexes,
  percentageRange
) => {
  const lineChartBox = lineChartWrapper
    .append("g")
    .attr("class", `custom-colored-pathes-wrapper`)
    .attr("style", `stroke-width: 1.5; stroke-opacity: 1; fill: none;`)
    .style("pointer-events", "none");

  const lines = lineChartWrapper.selectAll(".nv-linesWrap .nv-groups .nv-line")[0];
  if(lines) {
    const linePathesInitial = lines
      .map((line) => {
        const indexPath = Number(line.parentNode.getAttribute("class").split("nv-series-")[1]);
        const isLabelColor = labelColorsIndexes.includes(indexPath);
        return !isLabelColor ? line.getAttribute("d") : null;
      })
      .filter(Boolean);
    const linePathes = linePathesInitial.map((path) => makeLinePathReadable(path).substring(1));
    const parsedPathesArray = linePathes.map((path) => path.split(" "));
    const coordsArrays = parsedPathesArray.map((pathArray) => getCoordsForLineInterpolation(pathArray));

    const lineChartBackgroundRect = lineChartWrapper.select(".nv-background > rect");
    const { height: backgroundRectHeight } = lineChartBackgroundRect?.node()?.getBBox() || { height: 0 };
    const conditionalFormattingSectionsForColorPathes = getConditionalFormattingSectionsForColorPathes(
      conditional_formatting,
      minMaxLineChartValuesY,
      backgroundRectHeight,
      percentageRange
    );

    const renderСoloredPathes = (coloredPathesToRender) => {
      lineChartBox.html("");
      coloredPathesToRender.forEach(({ stroke, d }) => {
        lineChartBox
          .append("path")
          .attr("class", `colored-path`)
          .attr("style", `stroke: ${stroke};`)
          .attr("d", d);
      });
    };

    const coloredPathesToRender = [];
    fillСoloredPathesToRender(coordsArrays, conditionalFormattingSectionsForColorPathes, coloredPathesToRender);
    renderСoloredPathes(coloredPathesToRender);
  }
};

const getIndexForColorLabel = (key, data) => data.findIndex((value) => value?.key === key);

const nvd3Vis = function(slice, payload, __, metadata) {
  const namesSet = new Set(slice?.formData?.url_drilldowns.map((item) => item.field) ?? []);
  let chart;
  let colorKey = "key";
  const isExplore = $("#explore-container").length === 1;

  let data = [];
  if(payload.data) {
    data = payload.data.map(x => ({
      ..._.cloneDeep(x), // так как nvd3 меняет данные, а так как у данных многоуровневая структура json то надо применить lodash
      key: formatLabel(x.key, slice.datasource.verbose_map, slice.formData.viz_type),
      originalKey: x.key
    }));
  }

  slice.container.html("");
  slice.clearError();

  let width = slice.width();
  const fd = slice.formData;
  const { utc_offset } = payload;

  const barchartWidth = function() {
    let bars;
    if(fd.bar_stacked) {
      bars = d3.max(data, function(d) {
        return d.values ? d.values.length : 0;
      });
    } else {
      bars = d3.sum(data, function(d) {
        return d.values ? d.values.length : 0;
      });
    }
    if(bars * minBarWidth > width) {
      return bars * minBarWidth;
    }
    return width;
  };

  const vizType = fd.viz_type;
  const f = d3.format(".3s");
  const reduceXTicks = fd.reduce_x_ticks || false;
  let stacked = false;
  let row;

  const drawGraph = function() {
    let svg = d3.select(slice.selector).select("svg");
    if(svg.empty()) {
      svg = d3.select(slice.selector).append("svg");
    }
    let height = slice.height();
    const isTimeSeries = [line, dual_line, area, compare, bar, time_pivot].indexOf(vizType) >= 0;

    // Handling xAxis ticks settings
    let xLabelRotation = 0;
    let staggerLabels = false;
    if(fd.x_ticks_layout === "auto") {
      if([column, dist_bar].indexOf(vizType) >= 0) {
        xLabelRotation = 45;
      } else if(isTimeSeries) {
        staggerLabels = true;
      }
    } else if(fd.x_ticks_layout === "staggered") {
      staggerLabels = true;
    } else if(fd.x_ticks_layout === "45°") {
      if(isTruthy(fd.show_brush)) {
        const error = t("You cannot use 45° tick layout along with the time range filter");
        slice.error(error);
        return null;
      }
      xLabelRotation = 45;
    }
    const showBrush =
      isTruthy(fd.show_brush) ||
      (fd.show_brush === "auto" && height >= minHeightForBrush && fd.x_ticks_layout !== "45°");

    function slicePrevKeys(array) {
      if(Array.isArray(array)) {
        array = [...array];

        const isNoTransition =
          slice.prevFormData === undefined || (Array.isArray(slice.prevFormData) && slice.prevFormData.length === 0);
        let sliceStart = 1;

        if(isNoTransition) {
          sliceStart = payload.form_data.groupby.length;
        }
        if(
          (vizType === bar || vizType === line) &&
          array[0].originalKey &&
          array[0].originalKey.length > 1
        ) {
          return array.map(item => ({
            ...item
            // key: isNoTransition
            //   ? Array.isArray(item.originalKey) ? item.originalKey.join(', ') : item.originalKey
            //   : item.originalKey[item.originalKey.length - 1],
          }));
        } else if(vizType === dist_bar) {
          return array.map((item) => {
            if(Array.isArray(item.values) && item.values[0].x.length > 1) {
              return {
                ...item,
                values: (item.values || []).map(val => ({
                  ...val
                  // TODO зачем не понятно .....
                  // x: val.x ? val.x.slice(-sliceStart) : val.x,
                }))
              };
            }
            return item;
          });
        } else if(vizType === pie) {
          return array.map(item => ({
            ...item
            // TODO зачем не понятно .....
            // x: item.x ? item.x.slice(-sliceStart) : item.x,
          }));
        }
      }

      return array;
    }

    switch(vizType) {
      case time_pivot:
        chart = nv.models.lineChart();
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        break;

      case dual_line:
        chart = nv.models.multiChart();
        // multi chart not support this events, but we need it
        chart.dispatch = d3.dispatch("stateChange", "renderEnd");
        chart.interpolate("linear");
        break;

      case bar:
        chart = nv.models
          .multiBarChart()
          .showControls(fd.show_controls)
          .groupSpacing(0.1);

        data = slicePrevKeys(data);

        if(!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        chart.xAxis.showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);

        if(fd.show_bar_value) {
          setTimeout(function() {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        break;

      case dist_bar:
        chart = nv.models
          .multiBarChart()
          .controlLabels({ grouped: t("grouped"), stacked: t("stacked") })
          .showControls(fd.show_controls)
          .reduceXTicks(reduceXTicks)
          .groupSpacing(0.1); // Distance between each group of bars.

        chart.xAxis.showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);
        data = slicePrevKeys(data);

        if(fd.order_bars) {
          data.forEach((d) => {
            d.values.sort((a, b) => (tryNumify(a.x) < tryNumify(b.x) ? -1 : 1));
          });
        }
        if(fd.show_bar_value) {
          setTimeout(function() {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        if(!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        break;

      case pie:
        chart = nv.models.pieChart();
        data = slicePrevKeys(data);
        colorKey = "x";
        chart.valueFormat(f);
        if(fd.donut) {
          chart.donut(true);
        }
        chart.labelsOutside(fd.labels_outside);
        chart.labelThreshold(0.05); // Configure the minimum slice size for labels to show up

        const getFormatValue = (value) => {
          const format = fd.number_format || ".3s";

          if(!isNaN(value) && value !== "") {
            return d3format(format, value);
          }
        };

        if(fd.pie_label_type === "key" || fd.pie_label_type === "value") {
          chart.labelType((d) => {
            const x = d.data.x;
            return [x[x.length - 1]];
          });

          chart.tooltip.valueFormatter(d => getFormatValue(d));
        }
        if(fd.pie_label_type === "value") {
          chart.labelType(d => getFormatValue(d.data.y));

          chart.tooltip.valueFormatter(d => getFormatValue(d));
        }

        if(fd.pie_label_type === "key_value") {
          chart.labelType(d => `${d.data.x}: ${getFormatValue(d.data.y)}`);
          chart.tooltip.valueFormatter(d => getFormatValue(d));
          height = height - 30;
        }

        if(fd.pie_label_type === "percent" || fd.pie_label_type === "key_percent") {
          let total = 0;
          data.forEach((d) => {
            total += d.y;
          });
          chart.tooltip.valueFormatter((d) => `${((d / total) * 100).toFixed()}%`);
          chart.labelType((d) => `${((d.data.y / total) * 100).toFixed()}%`);
          if(fd.pie_label_type === "key_percent") {
            chart.labelType((d) => `${d.data.x}: ${((d.data.y / total) * 100).toFixed()}%`);
          }
        }

        if(fd.pie_label_type === "percent_tenths") {
          let total = 0;
          data.forEach((d) => {
            total += d.y;
          });
          chart.labelType((d) => {
            return `${((d.value / total) * 100).toFixed(1)}%`;
          });
          chart.tooltip.valueFormatter((d) => {
            return `${((d / total) * 100).toFixed(1)}%`;
          });
        }

        break;

      case column:
        chart = nv.models.multiBarChart().reduceXTicks(false);
        break;

      case compare:
        chart = nv.models.cumulativeLineChart();
        chart.xScale(d3.time.scale.utc());
        chart.useInteractiveGuideline(true);
        chart.xAxis.showMaxMin(false);
        break;

      case bubble:
        row = (col1, col2) => `<tr><td>${col1}</td><td>${col2}</td></tr>`;
        chart = nv.models.scatterChart();
        chart.showDistX(true);
        chart.showDistY(true);
        chart.tooltip.contentGenerator(function(obj) {
          const p = obj.point;
          let s = "<table>";
          s += `<tr><td style="color: ${p.color};">` + `<strong>${p[fd.entity]}</strong> (${p.group})` + "</td></tr>";
          s += row(fd.x, f(p.x));
          s += row(fd.y, f(p.y));
          s += row(fd.size, f(p.size));
          s += "</table>";
          return s;
        });
        chart.pointRange([5, fd.max_bubble_size ** 2]);
        chart.pointDomain([0, d3.max(data, (d) => d3.max(d.values, (v) => v.size))]);
        break;

      case line:
        if(showBrush) {
          chart = nv.models.lineWithFocusChart();
          if(staggerLabels) {
            // Give a bit more room to focus area if X axis ticks are staggered
            chart.focus.margin({ bottom: 40 });
            chart.focusHeight(80);
          }
          chart.focus.xScale(d3.time.scale.utc());
        } else {
          chart = nv.models.lineChart();
        }

        data = slicePrevKeys(data);

        // To alter the tooltip header
        // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
        chart.x((d) => (typeof d.x === "string" ? Date.parse(d.x) : d.x));
        chart.xScale(d3.time.scale());
        chart.interpolate(fd.line_interpolation);
        break;

      case area:
        if(showBrush) {
          chart = nv.models.stackedAreaWithFocusChart();

          chart.brushExtent([
            new Date(d3.min(data[0].values, d => d.x)),
            new Date(d3.max(data[0].values, d => d.x))
          ]);

          if(staggerLabels) {
            // Give a bit more room to focus area if X axis ticks are staggered
            chart.focus.margin({ bottom: 40 });
            chart.focusHeight(80);
          }
          chart.focus.xScale(d3.time.scale.utc());
        } else {
          chart = nv.models.stackedAreaChart();
        }
        chart.showControls(fd.show_controls);
        chart.style(fd.stacked_style);
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        break;

      case box_plot:
        colorKey = "label";
        chart = nv.models.boxPlotChart();
        chart.x(d => d.label);
        chart.maxBoxWidth(75); // prevent boxes from being incredibly wide
        break;

      case bullet:
        chart = nv.models.bulletChart();
        break;

      default:
        throw new Error("Unrecognized visualization for nvd3" + vizType);
    }

    if(chart.xAxis && chart.xAxis.staggerLabels) {
      chart.xAxis.staggerLabels(staggerLabels);
    }
    if(chart.xAxis && chart.xAxis.rotateLabels) {
      chart.xAxis.rotateLabels(xLabelRotation);
    }
    if(chart.x2Axis && chart.x2Axis.staggerLabels) {
      chart.x2Axis.staggerLabels(staggerLabels);
    }
    if(chart.x2Axis && chart.x2Axis.rotateLabels) {
      chart.x2Axis.rotateLabels(xLabelRotation);
    }

    if("showLegend" in chart && typeof fd.show_legend !== "undefined") {
      if(width < BREAKPOINTS.small && vizType !== pie) {
        chart.showLegend(false);
      } else {
        chart.showLegend(fd.show_legend);
      }
    }
    chart.legend.maxKeyLength(Number(slice.formData.legend_characters_number) || 40);
    if((vizType === bar || vizType === dist_bar) && chart.showLegend()) {
      chart.legend.margin({ bottom: 30, left: 0, right: 0, top: 5 });
      height = height - 30;
    }

    if(vizType === bullet) {
      height = Math.min(height, 50);
    }

    if(chart.forceY && fd.y_axis_bounds && (fd.y_axis_bounds[0] !== null || fd.y_axis_bounds[1] !== null)) {
      chart.forceY(fd.y_axis_bounds);
    }
    if(fd.y_log_scale) {
      chart.yScale(d3.scale.log());
    }
    if(fd.x_log_scale) {
      chart.xScale(d3.scale.log());
    }

    let xAxisFormatter = d3FormatPreset(fd.x_axis_format, fd.time_grain_sqla);
    if(isTimeSeries) {
      xAxisFormatter = d3TimeFormatPreset(fd.x_axis_format, utc_offset, fd.time_grain_sqla);
    }
    if(chart.x2Axis && chart.x2Axis.tickFormat) {
      chart.x2Axis.tickFormat(xAxisFormatter);
    }
    const isXAxisString = [dist_bar, box_plot].indexOf(vizType) >= 0;
    if(!isXAxisString && chart.xAxis && chart.xAxis.tickFormat) {
      chart.xAxis.tickFormat(xAxisFormatter);
    }

    const yAxisFormatter = d3FormatPreset(fd.y_axis_format, fd.time_grain_sqla);
    if(chart.yAxis && chart.yAxis.tickFormat) {
      if(fd.num_period_compare) {
        // When computing a "Period Ratio", we force a percentage format
        chart.yAxis.tickFormat(yAxisFormatter);
      } else {
        chart.yAxis.tickFormat(yAxisFormatter);
      }
    }
    if(chart.y2Axis && chart.y2Axis.tickFormat) {
      chart.y2Axis.tickFormat(yAxisFormatter);
    }

    // Set showMaxMin for all axis
    function setAxisShowMaxMin(axis, showminmax) {
      if(axis && axis.showMaxMin && showminmax !== undefined) {
        axis.showMaxMin(showminmax);
      }
    }

    setAxisShowMaxMin(chart.xAxis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.x2Axis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.yAxis, fd.y_axis_showminmax);
    setAxisShowMaxMin(chart.y2Axis, fd.y_axis_showminmax);

    if(vizType === time_pivot) {
      chart.color((d) => {
        const c = fd.color_picker;
        let alpha = 1;
        if(d.rank > 0) {
          alpha = d.perc * 0.5;
        }
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
      });
    } else if(vizType !== bullet) {
      chart.color(
        // d[colorKey] может быть == '', для присвоения элементу графика цвета из набора передадим в качестве ключа
        // хеш объекта
        d =>
          d.color ||
          getColorFromScheme(
            d[colorKey] || md5(JSON.stringify(d)),
            fd.color_scheme
          )
      );
    }
    if((vizType === line || vizType === area) && fd.rich_tooltip) {
      chart.useInteractiveGuideline(true);
      if(vizType === line) {
        // Custom sorted tooltip
        chart.interactiveLayer.tooltip.contentGenerator((d) => {
          let tooltip = "";
          tooltip +=
            "<table><thead><tr><td colspan='3'>" +
            `<strong data-timestamp="${d.value}" class='x-value'>${xAxisFormatter(d.value)}</strong>` +
            "</td></tr></thead><tbody>";
          d.series.sort((a, b) => (a.value >= b.value ? -1 : 1));
          d.series.forEach((series) => {
            tooltip +=
              `<tr class="${series.highlight ? "emph" : ""}">` +
              `<td class="legend-color-guide" style="opacity: ${series.highlight ? "1" : "0.75"};"">` +
              "<div " +
              `style="border: 2px solid ${series.highlight ? "black" : "transparent"}; background-color: ${
                series.color
              };"` +
              "></div>" +
              "</td>" +
              `<td>${series.key}</td>` +
              `<td>${yAxisFormatter(series.value)}</td>` +
              "</tr>";
          });
          tooltip += "</tbody></table>";
          return tooltip;
        });
      }
    } else if((vizType === line || vizType === area) && !fd.rich_tooltip) {
      if(vizType === line) {
        chart.tooltip.contentGenerator((d) => {
          const currentMetric = d.series[0];
          let tooltip = "";
          tooltip +=
            "<table><thead><tr><td colspan='3'>" +
            `<strong data-timestamp="${d.value}" class='x-value'>${xAxisFormatter(d.value)}</strong>` +
            "</td></tr></thead>" +
            "<tbody>" +
            "<tr>" +
            "<td class='legend-color-guide' style='opacity: 0.75'>" +
            `<div style="border: 2px solid transparent; background-color: ${currentMetric.color}"></div>` +
            "</td>" +
            `<td>${currentMetric?.key}</td>` +
            `<td>${yAxisFormatter(currentMetric?.value)}</td>` +
            "</tr>";
          tooltip += "</tbody></table>";
          return tooltip;
        });
      }
    }

    if(vizType === dual_line) {
      const yAxisFormatter1 = d3.format(fd.y_axis_format);
      const yAxisFormatter2 = d3.format(fd.y_axis_2_format);
      chart.yAxis1.tickFormat(yAxisFormatter1);
      chart.yAxis2.tickFormat(yAxisFormatter2);
      customizeToolTip(chart, xAxisFormatter, [yAxisFormatter1, yAxisFormatter2]);
      chart.showLegend(width > BREAKPOINTS.small);
    }
    chart.height(height);

    if(slice.container && slice.container.css) {
      slice.container.css("height", height + "px");
    }

    svg
      .datum(data)
      .transition()
      .duration(500)
      .attr("height", height)
      .attr("width", width)
      .call(chart);

    if(fd.show_markers) {
      svg
        .selectAll(".nv-point")
        .style("stroke-opacity", 1)
        .style("fill-opacity", 1);
    }

    if(slice.container && (chart.yAxis !== undefined || chart.yAxis2 !== undefined)) {
      // Hack to adjust y axis left margin to accommodate long numbers
      const containerWidth = slice.container.width();
      const marginPad = Math.ceil(Math.min(isExplore ? containerWidth * 0.01 : containerWidth * 0.03, maxMarginPad));
      const maxYAxisLabelWidth = chart.yAxis2
        ? getMaxLabelSize(slice.container, "nv-y1")
        : getMaxLabelSize(slice.container, "nv-y");
      const maxXAxisLabelHeight = getMaxLabelSize(slice.container, "nv-x");
      chart.margin({ left: maxYAxisLabelWidth + marginPad });
      if(fd.y_axis_label && fd.y_axis_label !== "") {
        chart.margin({ left: maxYAxisLabelWidth + marginPad + 25 });
      }
      // Hack to adjust margins to accommodate long axis tick labels.
      // - has to be done only after the chart has been rendered once
      // - measure the width or height of the labels
      // ---- (x axis labels are rotated 45 degrees so we use height),
      // - adjust margins based on these measures and render again
      const margins = chart.margin();
      margins.bottom = 28;
      if(fd.x_axis_showminmax) {
        // If x bounds are shown, we need a right margin
        margins.right = Math.max(20, maxXAxisLabelHeight / 2) + marginPad;
      }
      if(xLabelRotation === 45) {
        margins.bottom = maxXAxisLabelHeight + marginPad;
        margins.right = maxXAxisLabelHeight + marginPad;
      } else if(staggerLabels) {
        margins.bottom = 40;
      }

      if(vizType === dual_line) {
        const maxYAxis2LabelWidth = getMaxLabelSize(slice.container, "nv-y2");
        // use y axis width if it's wider than axis width/height
        if(maxYAxis2LabelWidth > maxXAxisLabelHeight) {
          margins.right = maxYAxis2LabelWidth + marginPad;
        }
      }
      if(fd.bottom_margin && fd.bottom_margin !== "auto") {
        margins.bottom = parseInt(fd.bottom_margin, 10);
      }
      if(fd.left_margin && fd.left_margin !== "auto") {
        margins.left = fd.left_margin;
      }

      if(fd.x_axis_label && fd.x_axis_label !== "" && chart.xAxis) {
        margins.bottom += 25;
        let distance = 0;
        if(margins.bottom && !isNaN(margins.bottom)) {
          distance = margins.bottom - 45;
        }
        // nvd3 bug axisLabelDistance is disregarded on xAxis
        // https://github.com/krispo/angular-nvd3/issues/90
        chart.xAxis.axisLabel(fd.x_axis_label).axisLabelDistance(distance);
      }

      if(fd.y_axis_label && fd.y_axis_label !== "" && chart.yAxis) {
        let distance = 0;
        if(margins.left && !isNaN(margins.left)) {
          distance = margins.left - 70;
        }
        chart.yAxis.axisLabel(fd.y_axis_label).axisLabelDistance(distance);
      }

      const annotationLayers = (slice.formData.annotation_layers || []).filter(
        x => x.show
      );
      if(isTimeSeries && annotationLayers && slice.annotationData) {
        // Time series annotations add additional data
        const timeSeriesAnnotations = annotationLayers
          .filter(a => a.annotationType === AnnotationTypes.TIME_SERIES)
          .reduce(
            (bushel, a) =>
              bushel.concat(
                (slice.annotationData[a.name] || []).map((series) => {
                  if(!series) {
                    return {};
                  }
                  const key = Array.isArray(series.key)
                    ? `${a.name}, ${series.key.join(", ")}`
                    : `${a.name}, ${series.key}`;
                  return {
                    ...series,
                    key,
                    color: a.color,
                    strokeWidth: a.width,
                    classed: `${a.opacity} ${a.style}`
                  };
                })
              ),
            []
          );
        data.push(...timeSeriesAnnotations);
      }

      // render chart
      svg
        .datum(data)
        .transition()
        .duration(500)
        .attr("height", height)
        .attr("width", width)
        .call(chart);

      // on scroll, hide tooltips. throttle to only 4x/second.
      $(window).scroll(throttle(hideTooltips, 250));

      // The below code should be run AFTER rendering because chart is updated in call()
      if(isTimeSeries && annotationLayers) {
        // Formula annotations
        const formulas = annotationLayers
          .filter(a => a.annotationType === AnnotationTypes.FORMULA)
          .map(a => ({ ...a, formula: mathjs.parse(a.value) }));

        let xMax;
        let xMin;
        let xScale;
        if(vizType === bar) {
          xMin = d3.min(data[0].values, d => d.x);
          xMax = d3.max(data[0].values, d => d.x);
          xScale = d3.scale
            .quantile()
            .domain([xMin, xMax])
            .range(chart.xAxis.range());
        } else {
          xMin = chart.xAxis
            .scale()
            .domain()[0]
            .valueOf();
          xMax = chart.xAxis
            .scale()
            .domain()[1]
            .valueOf();
          xScale = chart.xScale ? chart.xScale() : d3.scale.linear();
        }

        // TODO: Почему clamp может не быть? Падает на ресайзе filter box
        if(xScale.clamp) {
          xScale.clamp(true);
        }

        if(Array.isArray(formulas) && formulas.length) {
          const xValues = [];
          if(vizType === bar) {
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
            let period = Math.min(
              ...data.map(d =>
                Math.min(
                  ...d.values.slice(1).map((v, i) => v.x - d.values[i].x)
                )
              )
            );
            const dataPoints = (xMax - xMin) / (period || 1);
            // make sure that there are enough data points and not too many
            period = dataPoints < 100 ? (xMax - xMin) / 100 : period;
            period = dataPoints > 500 ? (xMax - xMin) / 500 : period;
            xValues.push(xMin);
            for(let x = xMin; x < xMax; x += period) {
              xValues.push(x);
            }
            xValues.push(xMax);
          }
          const formulaData = formulas.map(fo => ({
            key: fo.name,
            values: xValues.map(x => ({ y: fo.formula.eval({ x }), x })),
            color: fo.color,
            strokeWidth: fo.width,
            classed: `${fo.opacity} ${fo.style}`
          }));
          data.push(...formulaData);
        }
        const xAxis = chart.xAxis1 ? chart.xAxis1 : chart.xAxis;
        const yAxis = chart.yAxis1 ? chart.yAxis1 : chart.yAxis;
        const chartWidth = xAxis.scale().range()[1];
        const annotationHeight = yAxis.scale().range()[0];
        const tipFactory = layer =>
          d3tip()
            .attr("class", "d3-tip")
            .direction("n")
            .offset([-5, 0])
            .html((d) => {
              if(!d) {
                return "";
              }
              const title =
                d[layer.titleColumn] && d[layer.titleColumn].length
                  ? d[layer.titleColumn] + " - " + layer.name
                  : layer.name;
              const body = Array.isArray(layer.descriptionColumns)
                ? layer.descriptionColumns.map(c => d[c])
                : Object.values(d);
              return "<div><strong>" + title + "</strong></div><br/>" + "<div>" + body.join(", ") + "</div>";
            });

        if(slice.annotationData) {
          // Event annotations
          annotationLayers
            .filter(
              (x) => x.annotationType === AnnotationTypes.EVENT && slice.annotationData && slice.annotationData[x.name]
            )
            .forEach((config, index) => {
              const e = applyNativeColumns(config);
              // Add event annotation layer
              const annotations = d3
                .select(slice.selector)
                .select(".nv-wrap")
                .append("g")
                .attr("class", `nv-event-annotation-layer-${index}`);
              const aColor = e.color || getColorFromScheme(e.name, fd.color_scheme);

              const tip = tipFactory(e);
              const records = (slice.annotationData[e.name].records || [])
                .map((r) => {
                  const timeValue = new Date(moment.utc(r[e.timeColumn]));

                  return {
                    ...r,
                    [e.timeColumn]: timeValue
                  };
                })
                .filter(
                  record =>
                    !Number.isNaN(record[e.timeColumn].getMilliseconds())
                );

              if(records.length) {
                annotations
                  .selectAll("line")
                  .data(records)
                  .enter()
                  .append("line")
                  .attr({
                    x1: d => xScale(new Date(d[e.timeColumn])),
                    y1: 0,
                    x2: d => xScale(new Date(d[e.timeColumn])),
                    y2: annotationHeight
                  })
                  .attr("class", `${e.opacity} ${e.style}`)
                  .style("stroke", aColor)
                  .style("stroke-width", e.width)
                  .on("mouseover", tip.show)
                  .on("mouseout", tip.hide)
                  .call(tip);
              }

              // update annotation positions on brush event
              chart.focus.dispatch.on("onBrush.event-annotation", function() {
                annotations
                  .selectAll("line")
                  .data(records)
                  .attr({
                    x1: d => xScale(new Date(d[e.timeColumn])),
                    y1: 0,
                    x2: d => xScale(new Date(d[e.timeColumn])),
                    y2: annotationHeight,
                    opacity: (d) => {
                      const x = xScale(new Date(d[e.timeColumn]));
                      return x > 0 && x < chartWidth ? 1 : 0;
                    }
                  });
              });
            });

          // Interval annotations
          annotationLayers
            .filter(
              x =>
                x.annotationType === AnnotationTypes.INTERVAL &&
                slice.annotationData &&
                slice.annotationData[x.name]
            )
            .forEach((config, index) => {
              const e = applyNativeColumns(config);
              // Add interval annotation layer
              const annotations = d3
                .select(slice.selector)
                .select(".nv-wrap")
                .append("g")
                .attr("class", `nv-interval-annotation-layer-${index}`);

              const aColor = e.color || getColorFromScheme(e.name, fd.color_scheme);
              const tip = tipFactory(e);

              const records = (slice.annotationData[e.name].records || [])
                .map((r) => {
                  const timeValue = new Date(moment.utc(r[e.timeColumn]));
                  const intervalEndValue = new Date(moment.utc(r[e.intervalEndColumn]));
                  return {
                    ...r,
                    [e.timeColumn]: timeValue,
                    [e.intervalEndColumn]: intervalEndValue
                  };
                })
                .filter(
                  record =>
                    !Number.isNaN(record[e.timeColumn].getMilliseconds()) &&
                    !Number.isNaN(record[e.intervalEndColumn].getMilliseconds())
                );

              if(records.length) {
                annotations
                  .selectAll("rect")
                  .data(records)
                  .enter()
                  .append("rect")
                  .attr({
                    x: d =>
                      Math.min(
                        xScale(new Date(d[e.timeColumn])),
                        xScale(new Date(d[e.intervalEndColumn]))
                      ),
                    y: 0,
                    width: d =>
                      Math.max(
                        Math.abs(
                          xScale(new Date(d[e.intervalEndColumn])) -
                          xScale(new Date(d[e.timeColumn]))
                        ),
                        1
                      ),
                    height: annotationHeight
                  })
                  .attr("class", `${e.opacity} ${e.style}`)
                  .style("stroke-width", e.width)
                  .style("stroke", aColor)
                  .style("fill", aColor)
                  .style("fill-opacity", 0.2)
                  .on("mouseover", tip.show)
                  .on("mouseout", tip.hide)
                  .call(tip);
              }

              // update annotation positions on brush event
              chart.focus.dispatch.on("onBrush.interval-annotation", function() {
                annotations
                  .selectAll("rect")
                  .data(records)
                  .attr({
                    x: (d) => xScale(new Date(d[e.timeColumn])),
                    width: (d) => {
                      const x1 = xScale(new Date(d[e.timeColumn]));
                      const x2 = xScale(new Date(d[e.intervalEndColumn]));
                      return x2 - x1;
                    }
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
    const str = Array.isArray(dataKey) ? dataKey.join(", ") : dataKey;
    const payloadData = (payload && payload.data) || [];
    const { key: result } = payloadData.find(({ key }) => (Array.isArray(key) ? key.join(", ") : key) === str) || {
      key: []
    };
    return Array.isArray(result) ? result : [result];
  };

  const contextMenu = (data) => {
    const breakdownColumns = slice.formData.columns;
    const sliceColumns = slice.formData.groupby;
    let contextColumns;
    let contextBreakdownColumns = [];
    const contextFilters = [];
    let periodFilters = [];
    const xAxisName = slice.formData.granularity_sqla;
    const timeGrainSqla = slice.formData.time_grain_sqla;
    let xAxisValue;
    const dataKey = getAggregateTranslateValue(data?.key) || data?.key;
    const dataKeyArray = getAppropriateDataKey(dataKey);
    const drilldownUrls = slice.formData.url_drilldowns;
    const isComulativeTotal =
      slice.formData.metrics.find((metric) => metric?.label === dataKey)?.cumulativeTotal ||
      slice.formData.metrics.find((metric) => drilldownUrls.find((url) => metric?.label === url?.field))
        ?.cumulativeTotal;
    const checkIsMetric = (string) =>
      slice.formData.metrics.some((metric) => {
        if(typeof metric === "string") {
          return string === metric;
        }
        const { label } = metric;
        if(label) {
          return string === getAggregateTranslateLabel(label);
        }
        return false;
      });
    switch(slice.formData.viz_type) {
      case "pie":
        contextColumns = data.data.x;
        break;
      case "bar":
      case "line": {
        contextColumns = data.key
          .split(",")
          .map((col) => col.trim())
          .filter((col) => !checkIsMetric(col));

        const tooltipValue = document.querySelector("strong.x-value");
        const xValFromTooltip = tooltipValue?.dataset.timestamp ?? Date.now();

        xAxisValue = (Array.isArray(d3.event?.target?.__data__)
          ? d3.event?.target?.__data__[0]?.x
          : d3.event?.target?.__data__?.x) || +xValFromTooltip;

        if(payload.form_data.time_grain_sqla) {
          periodFilters = getFiltersForXAxis(xAxisName, xAxisValue, timeGrainSqla, isComulativeTotal);
        } else {
          if(slice.formData.viz_type === "bar" && isComulativeTotal) {
            contextFilters.push({
              ...getFiltersForXAxis(xAxisName, xAxisValue, null, isComulativeTotal),
              isComulativeTotal: true
            });
          } else {
            contextFilters.push(getFiltersForXAxis(xAxisName, xAxisValue));
          }
        }
        break;
      }
      default:
        contextColumns = data.x ?? [];
        contextBreakdownColumns = [];
        dataKeyArray.forEach((key) => {
          key.split(",").forEach((columnName) => {
            if(!checkIsMetric(columnName)) {
              contextBreakdownColumns.push(columnName);
            }
          });
        });
    }
    if(slice.formData.viz_type === bar) {
      const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";
      const { granularity_sqla, time_grain_sqla } = slice.formData;
      const { from_dttm, to_dttm } = payload.form_data;

      const targetDate = moment(data.x);

      const timeUnit = "";
      let beginDate, endDate;

      if(time_grain_sqla === null) {
        beginDate = from_dttm;
        endDate = to_dttm;
      } else {
        function getExtraMinutes() {
          const minutes = {
            PT1M: 0,
            PT5M: 4,
            PT10M: 9
          };

          return minutes[time_grain_sqla] ? minutes[time_grain_sqla] : 0;
        }

        function getTimeUnit() {
          const minute = "minute";
          const units = {
            "PT1M": minute,
            "PT5M": minute,
            "PT10M": minute,
            "PT1H": "hour",
            "P1D": "day",
            "P1M": "month",
            "P0.25Y": "quarter",
            "P1Y": "year"
          };

          return units[time_grain_sqla];
        }

        beginDate = targetDate.startOf(timeUnit).format(DATE_FORMAT);
        endDate = targetDate
          .add(getExtraMinutes())
          .endOf(getTimeUnit())
          .format(DATE_FORMAT);
      }

      periodFilters = isComulativeTotal
        ? [
          {
            op: "<=",
            conjuction: "and",
            col: granularity_sqla,
            val: endDate,
            isPeriod: true
          }
        ]
        : [
          {
            op: ">=",
            conjuction: "and",
            col: granularity_sqla,
            val: beginDate,
            isPeriod: true
          },
          {
            op: "<=",
            conjuction: "and",
            col: granularity_sqla,
            val: endDate,
            isPeriod: true
          }
        ];
    }

    contextColumns?.forEach((col, index) => {
      // const i = (slice.prevFormData !== undefined && slice.prevFormData.length) ? sliceColumns.length - 1 : index;
      const i = index;
      if(sliceColumns[i]) {
        const filter = {
          col: sliceColumns[i],
          op: "in",
          val: [typeof col === "string" ? col.trim() : col]
        };
        contextFilters.push(filter);
      }
    });
    contextBreakdownColumns.forEach((col, index) => {
      const i = slice.prevFormData !== undefined && slice.prevFormData.length ? breakdownColumns.length - 1 : index;
      // const i = index;
      if(breakdownColumns[i]) {
        const filter = {
          col: breakdownColumns[i],
          op: "in",
          val: [col.trim()]
        };
        contextFilters.push(filter);
      }
    });
    const hierarcyManager = new Hierarchy(slice, payload);

    let urlDrilldowns = [];

    slice.formData.metrics.forEach((m) => {
      let fieldName;

      if(typeof m === "string") {
        fieldName = m;
      } else if(typeof m === "object") {
        fieldName = m.label;
      }
      const result = hierarcyManager.getUrlDrilldowns(
        fieldName,
        contextFilters,
        payload.form_data.time_grain_sqla === null ? [] : periodFilters
      );

      urlDrilldowns = [...urlDrilldowns, ...result];
    });


    const hierarchyDrilldowns = [];
    const processHierarchyDrilldown = (options) => {
      let { groupbyArray } = options || {};
      groupbyArray = groupbyArray || [];
      payload.hierarchy.forEach((h) => {
        if(slice.formData.disabled_hierarchy.findIndex((dh) => dh === h.id) !== -1) {
          return;
        }

        const currentHierarchyDrilldown = [];
        const mapColumnToDrilldown = (hierarchyColumn) => {
          const drilldown = {
            id: hierarchyColumn.id,
            order: hierarchyColumn.order,
            title: hierarchyColumn.verbose_name || hierarchyColumn.name,
            action: !contextMenuEnabled()
              ? () => {
              }
              : () => {
                let hierarchyContextColumns;
                let hierarchyContextBreakdownColumns = [];
                // const columnNameIsSliced = (slice.prevFormData !== undefined && slice.prevFormData.length);
                const columnNameIsSliced = false;
                const hierarchyContextFilters = _.clone(contextFilters);

                switch(slice.formData.viz_type) {
                  case "pie":
                    hierarchyContextColumns = data.data.x;
                    hierarchyColumn.value = data.data.x[data.data.x.length - 1];
                    break;
                  case "bar":
                  case "line":
                    hierarchyContextColumns = [data.key];
                    hierarchyColumn.value = data.key;
                    periodFilters = getFiltersForXAxis(
                      xAxisName,
                      xAxisValue,
                      timeGrainSqla,
                      isComulativeTotal
                    );
                    break;
                  default:
                    hierarchyContextColumns = data.x;
                    hierarchyColumn.value = data.x;
                    hierarchyContextBreakdownColumns = dataKeyArray;
                    break;
                }
                hierarchyContextColumns
                  .filter((column) => contextColumns?.includes(column))
                  .forEach((column, index) => {
                    const filter = {
                      col: sliceColumns[columnNameIsSliced ? sliceColumns.length - 1 : index],
                      // col: sliceColumns[index],
                      op: "in",
                      val: [column.trim()]
                    };
                    hierarchyContextFilters.push(filter);
                  });
                hierarchyContextBreakdownColumns
                  .filter((column) => contextColumns?.includes(column))
                  .forEach((column, index) => {
                    const filter = {
                      // col: breakdownColumns[index],
                      col: breakdownColumns[columnNameIsSliced ? sliceColumns.length - 1 : index],
                      op: "in",
                      val: [column.trim()]
                    };
                    hierarchyContextFilters.push(filter);
                  });
                hierarcyManager.drilldownToHierarchy(
                  hierarchyColumn,
                  _.uniqWith(hierarchyContextFilters, _.isEqual),
                  null,
                  null,
                  null,
                  periodFilters
                );
              }
          };
          return drilldown;
        };

        // Если нет столбцов для группировки, берется столбец с самым маленьким order
        if(!slice.formData.groupby.length && h.columns[0]) {
          const nextColumn = hierarcyManager.getNextColumnByHierarchy(h, h.columns[0]);
          if(nextColumn) {
            currentHierarchyDrilldown.push(mapColumnToDrilldown(nextColumn));
          }
        } else {
          // Если есть, для каждого ищется следующий по иерархии
          const nextColumns = h.columns
            .filter((hierarchyColumn) => groupbyArray.includes(hierarchyColumn.name))
            .map((hierarchyColumn) => hierarcyManager.getNextColumnByHierarchy(h, hierarchyColumn))
            .filter((item) => item);
          nextColumns // Если найденный следующий уже присутствует в группировке - его не предлагать
            .filter(item => !groupbyArray.includes(item.name))
            .forEach((item) => {
              currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
            });
        }

        if(currentHierarchyDrilldown.length) {
          hierarchyDrilldowns.push({
            title: h.verbose_name || h.name
          });
          currentHierarchyDrilldown.forEach((item) => {
            hierarchyDrilldowns.push(item);
          });
        }
      });
    };
    // Для viz_type == line Система не должна выводить меню перехода по иерархии,
    // если в отчете не используется показатель, примененный в иерархии
    const groupbyArray = slice.formData.groupby || {};
    switch(slice.formData.viz_type) {
      case line:
        if(slice.formData.groupby.length) {
          processHierarchyDrilldown({ groupbyArray });
        }
        break;
      case dist_bar:
        processHierarchyDrilldown({
          groupbyArray: slice.formData.columns.length ? groupbyArray.concat(slice.formData.columns) : groupbyArray
        });
        break;
      default:
        processHierarchyDrilldown({ groupbyArray });
        break;
    }
    return [...hierarchyDrilldowns, ...urlDrilldowns];
  };

  const renderLegendConditionalFormatting = (selector, conditional_formatting, width) => {
    const colors = [];
    const labels = [];
    conditional_formatting.forEach(({ color, description }) => {
      colors.push(`rgb(${color.r}, ${color.g}, ${color.b})`);
      labels.push(description);
    });
    const div = d3.select(selector);
    div.selectAll("*").remove();
    const svg = div.append("svg").attr("width", width);
    const legend = nv.models
      .legend()
      .color((d) => colors[d.index])
      .width(width - 20)
      .rightAlign(false)
      .maxKeyLength(LEGEND_MAX_KEY_LENGTH);
    const gLegend = svg
      .append("g")
      .attr("class", "nv-labels-legendWrap")
      .datum(
        labels.map((label, index) => ({
          key: label,
          index
        }))
      )
      .call(legend);
    const { height: legendHeight, width: legendWidth } = gLegend?.node()?.getBoundingClientRect() || {
      height: 0,
      width: 0
    };
    svg.attr("height", legendHeight + 5);
    gLegend.attr("transform", `translate(${(width - legendWidth) / 2}, -5)`);
  };

  nv.addGraph(drawGraph, function(resultChart) {
    let selector = slice.formData.viz_type;
    if(slice.formData.viz_type === "dist_bar" || slice.formData.viz_type === "bar") {
      selector = ".nv-bar";
    }
    if(slice.formData.viz_type === "pie") selector = ".nv-pie > .nv-slice";

    const fixMenuPosition = () => {
      // fix menu position to prevent going righter screen
      const d3menu = d3.select(".d3-context-menu");
      const widthStr = d3menu.style("width");
      const widthNum = parseInt(widthStr.substring(0, widthStr.length - 2), 10);
      if(d3.event.x + widthNum > window.innerWidth - 20) {
        d3menu.style("left", "auto");
        d3menu.style("right", 0);
      }
    };
    const applyContextMenuForLines = () => {
      if(slice.formData.viz_type === "line") {
        // для алгоритма viz_type === line
        d3.selectAll(`#${slice.containerId} .nv-group`)
          .style("pointer-events", "none")
          .on("contextmenu", (event) => {
            const items = contextMenu(event);
            if(items.length && checkVizTypeDDLines(event, namesSet, slice, payload)) {
              d3.contextMenu(() => items)();
              fixMenuPosition();
            }
          });
      } else {
        // для алгоритма viz_type === bar
        d3.selectAll(`#${slice.containerId} .nv-focus > .nv-series, #${slice.containerId} .nv-group`)
          .style("pointer-events", "all")
          .on("contextmenu", (event) => {
            const items = contextMenu(event);
            if(items.length) {
              d3.contextMenu(() => items)();
              fixMenuPosition();
            }
          });
      }
    };

    const builderGraphicGroups = () => {
      if(slice.formData.viz_type === "line") {
        // DD для линий
        d3.selectAll(`#${slice.containerId} .nv-focus > .nv-series, #${slice.containerId} .nv-group`).classed(
          "nvGroupDD",
          (event) => {
            const items = contextMenu(event);
            return !!items.length && checkVizTypeDDLines(event, namesSet, slice, payload);
          }
        );
      } else if(slice.formData.viz_type === "dist_bar" || slice.formData.viz_type === "bar") {
        // DD для гистограмм
        d3.selectAll(`#${slice.containerId} .nv-group`).classed(
          "nvGroupDD",
          (event) => {
            const items = contextMenu(event);
            return !!items.length;
          }
        );
      } else {
        // DD для всего остального
        d3.selectAll(`#${slice.containerId} .nv-pieChart .nv-slice`).classed("nvSliceDD", (event) => {
          const items = contextMenu(event);
          return !!items.length;
        });
      }
    };

    builderGraphicGroups();

    const svgContainer = document.querySelector(`#${slice.containerId}`);
    const legend = svgContainer?.querySelector(".nv-legendWrap.nvd3-svg");
    if(vizType === pie && legend && chart.showLegend()) {
      sliceLegendNamesPie(slice, false, chart);
    }
    splitLabelIntoMultipleLines(slice);
    sliceNamesPie(slice);
    refactorPositionPie(resultChart, slice);

    let timerBar = -1;
    let timerID = -1;
    let timerPieChartClickID = -1;
    const builderGraphicGroupsDebounce = () => {
      if(fd.show_bar_value) {
        const barWrapper = document.querySelector(`#${slice.containerId} .nv-barsWrap.nvd3-svg`);
        barWrapper.removeChild(barWrapper.lastChild);
        clearTimeout(timerBar);
        timerBar = setTimeout(function() {
          let svg = d3.select(slice.selector).select("svg");
          addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
        }, 500);
      }

      if(vizType === pie) {
        const isCollapse = true;
        if(legend && fd.show_legend) {
          sliceLegendNamesPie(slice, isCollapse);
        }
        splitLabelIntoMultipleLines(slice, isCollapse);
        sliceNamesPie(slice, isCollapse);
        clearTimeout(timerPieChartClickID);
        timerPieChartClickID = setTimeout(() => {
          if(legend && fd.show_legend) {
            sliceLegendNamesPie(slice, false, chart);
          }
          splitLabelIntoMultipleLines(slice);
          sliceNamesPie(slice);
        });
      }
      clearTimeout(timerID);
      timerID = setTimeout(() => builderGraphicGroups(), 750);
    };
    if(collapseLegendCharts.has(vizType) && fd.show_legend) {
      rerenderBigLegend(slice, chart);
    }
    if(slice.formData.viz_type === "line") {
      selector = ".nv-legend .nv-series";
    }
    const applyContextMenu = () => {
      d3.selectAll(`#${slice.containerId} ${selector}`).on("contextmenu", (event) => {
        const items = contextMenu(event);
        if(items.length) {
          d3.contextMenu(() => items)();
          fixMenuPosition();
        }
      });
    };

    const monkeyPatchRescaleLabel = () => {
      if(slice.formData.viz_type === "compare") {
        d3.select(".nv-controlsWrap text").select(function() {
          if(this.innerHTML === "Re-scale y-axis" || this.getAttribute("t-key") === "Re-scale y-axis") {
            this.setAttribute("t-key", "Re-scale y-axis");
            this.innerHTML = t("Re-scale y-axis");
          }
          return this;
        });
      }
    };

    monkeyPatchRescaleLabel();
    const originalUpdate = resultChart.update;
    try {
      chart.dispatch.on("stateChange", () => {
        // TODO: stateChange последнее торчащее событие (есть еще changeState, вроде то же самое, но не из легенды),
        // после него вызывается chart.update() - непонятно, бросает ли он событие; renderEnd для тоггла легенды не вызывается;
        // прибег к monkeypatching'у метода update.
        resultChart.update = () => {
          originalUpdate();
          monkeyPatchRescaleLabel();
        };
      });
    } catch(e) {
      console.log(`chart ${slice.formData.viz_type} is not support stateChange event`);
    }


    chart.dispatch.on("renderEnd", (e) => {
      if(slice.formData.viz_type === "line" || slice.formData.viz_type === "bar") {
        applyContextMenuForLines();
      }

      const nv3DLegend = document.querySelector(`#${slice.containerId} .nvd3.nv-legend`);
      if(nv3DLegend) nv3DLegend.onclick = () => builderGraphicGroupsDebounce();

      const nvxNvBrush = document.querySelector(`#${slice.containerId} .nv-x.nv-brush`);
      if(nvxNvBrush) nvxNvBrush.onmouseout = () => builderGraphicGroupsDebounce();

      const showLegendBtn = document.querySelector(`#${slice.containerId} .showLegendBtn.addMargin`);
      if(showLegendBtn) showLegendBtn.onclick = () => builderGraphicGroupsDebounce();

      applyContextMenu();
    });

    const showConditionalFormattingLegend = fd.show_legend_conditional_formatting && data?.[0]?.values?.length;
    if(showConditionalFormattingLegend) {
      const div = d3.select(slice.selector);
      const combinedSelector = `legend-conditional-formatting legend-${slice.selector.slice(1)}`;
      div.append("div").classed(combinedSelector, true);
      renderLegendConditionalFormatting(`.legend-${slice.selector.slice(1)}`, fd.conditional_formatting, slice.width());
    }

    const shouldHandleConditionalFormatting =
      vizType === line && fd.conditional_formatting.length && data?.[0]?.values?.length;
    if(shouldHandleConditionalFormatting) {
      const {
        show_labels_conditional_formatting: showLabels,
        conditional_formatting,
        line_interpolation,
        slice_id,
        conditional_formatting_percentage: percentageRange
      } = fd;
      const minMaxLineChartValuesY = getMinMaxLineChartValuesY(data);
      let lineChartWrapper = d3.select(`.slice_${slice_id} .nv-focus`);
      // case when chart is not saved yet -> wrapper doesn't have id yet (in constructor)
      const isWrapperNotFound = lineChartWrapper && lineChartWrapper[0] && !lineChartWrapper[0][0];
      const isChartNotSavedInConstructor = isWrapperNotFound && window.location.pathname.includes("superset/explore");
      if(isChartNotSavedInConstructor) {
        lineChartWrapper = d3.select(`.slice_container.line .nv-focus`);
      }
      // case when chart is not saved yet -> wrapper doesn't have id yet ( in constructor)
      const isChartRenderedByDrilldown = isWrapperNotFound && window.location.pathname.includes("superset/dashboard");
      if(isChartRenderedByDrilldown) {
        lineChartWrapper = d3.select(`#${slice.containerId} .nv-focus`);
      }
      const validationRangeErrors = getValidationErrorsPositions(
        conditional_formatting,
        minMaxLineChartValuesY.max,
        percentageRange
      );
      const isValidationRangeErrors = validationRangeErrors.some((element) => element.length);

      if(!isValidationRangeErrors) {
        renderConditionalFormattingLinesAndLabels(
          lineChartWrapper,
          conditional_formatting,
          showLabels,
          minMaxLineChartValuesY,
          percentageRange
        );
        const isAppropriateLineInterpolation = line_interpolation === "linear";
        if(isAppropriateLineInterpolation) {
          const { label_colors: labelColors } = metadata || {};
          const labelColorsIndexes = [];
          if(labelColors) {
            for(let key in labelColors) {
              const index = getIndexForColorLabel(key, data);
              if(index > -1) {
                labelColorsIndexes.push(index);
              }
            }

          }
          renderLinesWithinTheRanges(
            lineChartWrapper,
            conditional_formatting,
            minMaxLineChartValuesY,
            labelColorsIndexes,
            percentageRange
          );

          // disabe original legend functionality
          d3.select(`${slice.selector} .nv-legendWrap`).style("pointer-events", "none");
        }
      }
    }
  });

  //визуализация DD
  nvd3DDVisualization(slice, payload);

  document.querySelector(`#${slice.containerId}`).oncontextmenu = (event) => {
    event.preventDefault();
    const svgContainer = document.querySelector(`#${slice.containerId} svg`);
    const rounds = svgContainer.querySelectorAll(".nv-point.hover");

    // если включенна иерархия DD разрешен всем, поэтому берем любую первую точку
    const currentRounds = checkDDHierarchyExist(payload.hierarchy, slice.formData) ? [rounds?.[0]] : rounds;
    if(currentRounds && currentRounds[0]) {
      currentRounds.forEach((round) => {
        const parentElementRound = round.parentElement;
        parentElementRound.dispatchEvent(
          new PointerEvent("contextmenu", {
            x: event.pageX,
            clientX: event.pageX,
            y: event.pageY,
            clientY: event.pageY
          })
        );
      });
    }
  };
};

export default nvd3Vis;
