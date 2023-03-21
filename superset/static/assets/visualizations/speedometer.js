import ReactDOM from "react-dom";
import React from "react";
import ReactSpeedometer from "react-d3-speedometer";
import d3 from "d3";
import nv from "nvd3";
import contextmenu from "d3-context-menu";
import { Hierarchy } from "../utils/hierarchy";
import { sectorsRanges as validatorSectors } from "../javascripts/explore/validators";
import { configureSpeedometer } from "./speedometr-config";
import "./speedometr.css";
import { speedometerDDVisualization } from "./helpers/ddVisualization/speedometerDDVisualization";

const LEGEND_MAX_KEY_LENGTH = 1000;

contextmenu(d3);

let previewValidatedSectors = null;

function renderLegend({ selector, colors, labels, width }) {
  const div = d3.select(selector);
  div.selectAll("*").remove();
  const svg = div
    .append("svg")
    .attr("width", width)
    .style("margin", "0 0 20px");

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
        key: label,
        index,
      }))
    )
    .call(legend);
  // устанавливаем высоты
  const { height: legendHeight, width: legendWidth } = gLegend.node().getBoundingClientRect();
  svg.attr("height", legendHeight + 15);
  gLegend.attr("transform", `translate(${(width - legendWidth) / 2},0)`);
}

function initContextMenu({ mainSelector, menuContext }) {
  // DD на стрелке
  d3.selectAll(mainSelector).on("contextmenu", () => {
    const items = menuContext();
    if (items.length) {
      d3.contextMenu(() => items)();
    }
  });
}

const getValueFromPercentage = (percentage, max) => (parseFloat(percentage) * parseFloat(max)) / 100;

const speedometer = (slice, payload) => {
  let width = slice?.width();
  let height = slice?.height();

  if (width > height) {
    width = height;
  } else {
    height = width;
  }
  const { formData } = slice ?? {};
  let { speedometer_sectors: speedometerSectors, conditional_formatting_percentage: percentageRange } = formData || {};

  const {
    number_format: numberFormat,
    speedometer_label: speedometerLabel,
    speedometer_unit: speedometerUnit,
    show_legend: showLegend,
    labels_outside: labelsOutside,
    metric,
  } = formData || {};

  const { data: json } = payload;
  const { data } = json || {};
  let [[value]] = data;
  const labelPosition = labelsOutside ? "OUTSIDE" : "INSIDE";
  // отвалидируем сектора спидометра и если будет ошибка применим previewValidatedSectors
  if (!validatorSectors(speedometerSectors, value)) {
    previewValidatedSectors = speedometerSectors.slice?.(0);
  } else if (previewValidatedSectors) {
    speedometerSectors = previewValidatedSectors;
  }

  const speedometerSegmentColors = [];
  const speedometerSegmentStops = [];
  const speedometerCustomSegmentLabels = [];
  const speedometerSegmentLabels = [];
  const legendSegmentColors = [];
  const legendSegmentLabels = [];

  const speedometerSectorsValidate = speedometerSectors.reduce((sectors, sector) => {
    const { from: fromInitial, to: toInitial } = sector;
    const from = percentageRange ? getValueFromPercentage(fromInitial, value) : fromInitial;
    const to = percentageRange ? getValueFromPercentage(toInitial, value) : toInitial;

    if (!sectors.length && parseFloat(to) > parseFloat(from)) {
      return sectors.concat([sector]);
    } else if (sectors.length) {
      const previewSector = sectors[sectors.length - 1];
      const { to: previewTo } = previewSector;
      if (parseFloat(previewTo) <= parseFloat(from) && parseFloat(to) > parseFloat(from)) {
        return sectors.concat([sector]);
      }
    }
    return sectors;
  }, []);

  let previewStop = 0;

  speedometerSectorsValidate.forEach((section, index) => {
    const { color, description, from: fromInitial, to: toInitial, labelLeft, labelRight } = section;
    const from = percentageRange ? getValueFromPercentage(fromInitial, value) : fromInitial;
    const to = percentageRange ? getValueFromPercentage(toInitial, value) : toInitial;
    const emptySegment = "";
    // пустая секция
    if (index !== 0 && +previewStop !== +from) {
      speedometerSegmentStops.push(parseFloat(previewStop));
      speedometerSegmentColors.push("rgba(255,255,255,1)");
      speedometerSegmentLabels.push(null);
      speedometerCustomSegmentLabels.push(emptySegment);
    }
    // первая секция
    if (index === 0) {
      speedometerCustomSegmentLabels.push(labelLeft || from || null);
    }

    speedometerSegmentColors.push(`rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
    legendSegmentColors.push(`rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
    legendSegmentLabels.push(description || null);
    speedometerSegmentLabels.push(description || null);
    speedometerSegmentStops.push(parseFloat(from));
    speedometerCustomSegmentLabels.push(labelRight || to || null);

    // последняя секция
    if (index === speedometerSectorsValidate.length - 1) {
      speedometerSegmentStops.push(parseFloat(to));
    }

    previewStop = to;
  });

  // секция по умолчанию если не заданы
  if (!speedometerSegmentStops.length) {
    speedometerSegmentStops.push(0);
    speedometerSegmentStops.push(value || 100);
  }

  // for DD on Pointer
  const menuContext = () => {
    const hierarcyManager = new Hierarchy(slice, payload);
    return hierarcyManager.getUrlDrilldowns(metric, []);
  };

  ReactDOM.render(
    <div style={{ textAlign: "center" }} key={Date.now()} className={"speedometer-chart"}>
      {showLegend && <div id={`${slice?.containerId}-legend`} />}
      <ReactSpeedometer
        currentValueText={"${value}" + (speedometerUnit ? " " + speedometerUnit : "")}
        needleHeightRatio={0}
        customSegmentStops={speedometerSegmentStops}
        segmentColors={speedometerSegmentColors}
        maxValue={Math.max(...speedometerSegmentStops)}
        minValue={Math.min(...speedometerSegmentStops)}
        width={Math.floor(width)}
        height={Math.floor(height * 0.8)}
        valueFormat={numberFormat}
        value={value}
      />
      {speedometerLabel && (
        <div
          className={`speedometerLabel`}
          style={{
            transform: `translate(0, -${height / 5}px)`,
            maxWidth: width * 0.8,
            margin: `0 auto`,
          }}
        >
          {speedometerLabel}
        </div>
      )}
    </div>,
    document.getElementById(slice?.containerId),
    () => {
      if (showLegend) {
        renderLegend({
          selector: `#${slice?.containerId}-legend`,
          colors: legendSegmentColors,
          labels: legendSegmentLabels,
          width: slice?.width(),
        });
      }
      initContextMenu({
        mainSelector: `#${slice?.containerId}`,
        menuContext,
      });
    }
  );
  const ringInset = labelPosition === "INSIDE" ? 30 : 40;
  const labelInset = labelPosition === "INSIDE" ? 20 : 30;
  const config = {
    ringInset,
    labelInset,
    ringWidth: 60,
    pointerTailLength: 5,
    pointerWidth: 10,
    needleColor: "steelblue",
    needleTransition: "easeQuadInOut",
    needleTransitionDuration: 500,
    needleHeightRatio: 0.9,
    minAngle: -90,
    maxAngle: 90,
    container: `#${slice?.containerId}`,
    width: Math.floor(width),
    height: Math.floor(height * 0.8),
    speedometerUnit,
    numberFormat,
    labelPosition,
    value,
    maxValue: Math.max(...speedometerSegmentStops),
    minValue: Math.min(...speedometerSegmentStops),
    segments: speedometerSegmentStops.length,
    paddingSegment: speedometerSegmentStops.length > 2,
    segmentLabels: speedometerSegmentLabels,
    segmentColors: speedometerSegmentColors,
    customSegmentStops: speedometerSegmentStops,
    customSegmentLabels:
      speedometerCustomSegmentLabels.length < 1 ? speedometerSegmentStops : speedometerCustomSegmentLabels,
  };
  configureSpeedometer(config);

  speedometerDDVisualization(menuContext(), slice?.containerId);
};

export default speedometer;
