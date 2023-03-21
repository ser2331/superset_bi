import d3, { selectAll } from "d3";
import $ from "jquery";
import moment from "moment";
import contextmenu from "d3-context-menu";
import { t } from "../javascripts/locales";
import { Hierarchy } from "../utils/hierarchy";
import { contextMenuEnabled } from "../utils/context_menu";
import { d3TimeFormatPreset } from "../javascripts/modules/utils";
import { getInitialState } from "../javascripts/dashboard/reducers";
import { getWheres } from "../javascripts/utils/common";
import "./bubble_map.css";
import {
  bubbleMapDDVisualizationDisable,
  bubbleMapDDVisualization,
  addContextMenuCursorToBalloon,
} from "./helpers/ddVisualization/bubbleMapDDVisualization";

contextmenu(d3);
const regExp = /<div>/i;
const regExpDrillDown = /drilldown/i;

const bubbleMap = (openDrilldown, closeDrilldown, clearDrilldownCharts, slice, payload) => {
  const { formData } = slice;
  const { data } = payload;
  let { bubble_map_metrics } = formData || {};

  const firstMetric = Array.isArray(bubble_map_metrics) && bubble_map_metrics?.[0];
  const firstMetricName = (typeof firstMetric === "string" ? firstMetric : firstMetric?.label) || "";
  const firstMetricColumnName = typeof firstMetric === "object" ? firstMetric?.column?.column_name : null;
  let width = slice.width();
  let height = slice.height();

  if (width > height) {
    width = height;
  } else {
    height = width;
  }

  let bubbleContainerId = `bubble-${slice.containerId}`;
  // create bubble map container
  const sliceContainer = d3.select(`#${slice.containerId}`);
  const sliceContainerIsExist = document.querySelector(`#bubble-${slice.containerId}`);
  const isDashBoard = window.location.pathname.includes("superset/dashboard");
  const heightValue = isDashBoard ? "90%" : `${height}px`;
  const witdthValue = isDashBoard ? "100%" : `${width}px`;
  sliceContainerIsExist && (bubbleContainerId = bubbleContainerId + -+Date.now());
  sliceContainer.selectAll("*").remove();
  sliceContainer
    .append("div")
    .classed("bubble-chart", true)
    .attr("id", bubbleContainerId)
    .attr("key", Date.now())
    .style("textAlign", "center")
    .style("height", heightValue)
    .style("width", witdthValue);

  const props = {
    bubbleContainerId,
    features: data?.features || [],
    areas: data?.areas,
    formData: { ...formData, firstMetricName, firstMetricColumnName },
    slice,
    payload,
    openDrilldown,
    closeDrilldown,
    clearDrilldownCharts,
  };
  ymaps.ready(() => {
    renderBubbleMap(props);
  });
};

async function renderBubbleMap(props) {
  const {
    bubbleContainerId,
    formData,
    areas,
    features,
    slice,
    payload,
    openDrilldown,
    closeDrilldown,
    clearDrilldownCharts,
  } = props;
  const {
    zoom,
    clustering,
    firstMetricName,
    firstMetricColumnName,
    autozoom,
    table_timestamp_format,
    time_grain_sqla,
    aggregation_by_area,
  } = formData;
  const info_panels_drilldown =
    slice.formData.url_drilldowns && slice.formData.url_drilldowns.some((drilldown) => drilldown.drilldownToInfoPanel);
  const isPoligonsEnabled = Boolean(formData.polygon_id) && areas;
  const isAggregationEnabled = isPoligonsEnabled && areas && aggregation_by_area;
  const center = getLatLongCenter(features);
  const dateFormatter = d3TimeFormatPreset(table_timestamp_format, time_grain_sqla);
  const bubbleMap = new ymaps.Map(
    bubbleContainerId,
    {
      center,
      zoom,
      behaviors: ["default", "scrollZoom"],
    },
    {
      searchControlProvider: "yandex#search",
    }
  );
  const placemarks = await getPlacemarks(
    features,
    firstMetricName,
    dateFormatter,
    slice,
    payload,
    firstMetricColumnName
  );
  const polygons = isPoligonsEnabled ? getPolygon(areas, bubbleMap) : [];
  let allPlacemarks = placemarks || [];
  let filteredPlacemarks = placemarks || [];
  if (isAggregationEnabled) {
    const { aggregationResult, placemarksData, allPointsInside } = await aggregateAreas(
      polygons,
      placemarks,
      firstMetricName,
      payload,
      slice
    );
    const areaCentres = await (isAggregationEnabled
      ? createCenters(bubbleMap, aggregationResult, placemarksData, slice, payload, dateFormatter, firstMetricName)
      : null);
    filteredPlacemarks = filterPlacemarks(placemarks, allPointsInside);
    areaCentres ? (allPlacemarks = [...placemarks, ...areaCentres]) : null;
  }
  const bounds = bubbleMap.geoObjects.getBounds();
  if (info_panels_drilldown && openDrilldown) {
    bubbleMapDDVisualization(slice, allPlacemarks);
    drilldownFromPlacemark(slice, payload, openDrilldown, closeDrilldown, clearDrilldownCharts, allPlacemarks);
  } else bubbleMapDDVisualizationDisable(slice);
  clustering
    ? getClusters(
        bubbleMap,
        filteredPlacemarks,
        dateFormatter,
        openDrilldown,
        closeDrilldown,
        clearDrilldownCharts,
        info_panels_drilldown,
        slice,
        payload
      )
    : filteredPlacemarks?.forEach((placemark) => bubbleMap.geoObjects.add(placemark));
  const resultBounds = isPoligonsEnabled && areas ? bounds : bubbleMap.geoObjects.getBounds();
  if (autozoom && resultBounds) {
    bubbleMap.setBounds(resultBounds, {
      checkZoomRange: true,
      zoomMargin: 9,
    });
  }
}

//----------Functions for placemark generation---------->
async function getPlacemarks(features, firstMetricName, dateFormatter, slice, payload, firstMetricColumnName) {
  const placemarks = [];
  const checked_map_icons = {};
  for (const feature of features) {
    const { position = [], items, metric: AggregatedMetric, map_icon, area_name } = feature;
    const { groupby, metric, pointName } = items[0] || {};
    const isPositionNotCorrect = getIsPositionNotCorrect(position);
    if (isPositionNotCorrect) {
      continue;
    }
    const multyplaied = items;
    const verbose_names = slice.datasource?.verbose_map;
    const dateTimeColumns = slice.columns
      .filter((column) => column.is_dttm)
      .map((column) => column.column_name)
      .concat(["__timestamp"]);
    const row = pointName
      ? [{ name: slice.formData.pointName, value: pointName }, ...groupby, ...metric]
      : [...groupby, ...metric];
    const iconContent = Array.isArray(AggregatedMetric)
      ? AggregatedMetric?.find((metricName) => metricName.name === firstMetricName)?.value ||
        AggregatedMetric[firstMetricName] ||
        ""
      : AggregatedMetric[firstMetricName] || "";
    const hintContent = area_name || (+pointName === 0 ? pointName : pointName || t("No name"));
    const balloonContent = getBalloonContent(row, verbose_names, dateTimeColumns, dateFormatter, multyplaied);
    const clusterOptionName = +pointName === 0 ? pointName : pointName || t("No name");
    const isImageExist = Object.keys(checked_map_icons).includes(map_icon)
      ? checked_map_icons && checked_map_icons[map_icon]
      : await CheckImageUrl(map_icon);
    const isIconNameCorrect = typeof map_icon === "string" && Boolean(map_icon.length);
    checked_map_icons[map_icon] = isImageExist;
    const placemarkData = {
      row,
      multyplaied,
      verbose_names,
      dateTimeColumns,
      dateFormatter,
      position,
      groupby,
      hintContent,
    };
    const itemsWithPosition = multyplaied.map((item) => (item ? { position, ...item } : null));
    const placemark = new ymaps.Placemark(
      position,
      getPointDataWithDefaultIcon(
        clusterOptionName,
        iconContent,
        hintContent,
        balloonContent,
        placemarkData,
        map_icon,
        itemsWithPosition
      ),
      isIconNameCorrect && isImageExist ? getPointOptionsForCustomIcon(map_icon) : getPointOptions()
    );

    placemark.events.add("balloonopen", () => {
      itemsWithPosition.forEach((item) => {
        const { groupby, metric, pointName, position } = item || {};
        const multyplaiedRow = pointName
          ? [{ name: slice.formData.pointName, value: pointName }, ...groupby, ...metric]
          : [...groupby, ...metric];
        const hintContent = +pointName === 0 ? pointName : pointName || t("No name");

        addContextEvent(multyplaiedRow, hintContent, position, dateTimeColumns, dateFormatter, slice, payload);
      });
    });
    placemarks.push(placemark);
  }
  placemarks.filter((placemark) => Boolean(placemark));
  return placemarks;
}
export function headColumnName(column, verbose_names) {
  return verbose_names && column && (verbose_names[column.name] ? verbose_names[column.name] : column.name);
}
export function bodyColumnName(column, dateTimeColumns, dateFormatter) {
  return (
    dateTimeColumns &&
    dateTimeColumns &&
    column &&
    (!dateTimeColumns.find((columnName) => columnName === column?.name) ? column.value : dateFormatter(column.value))
  );
}
export function getBalloonContent(row, verbose_names, dateTimeColumns, dateFormatter, multyplaied = []) {
  if (!row?.length) return undefined;
  const commonStyle = "text-align: center; padding: 4px";
  const selectClass = row
    .reduce((fullName, column) => fullName + "-" + bodyColumnName(column, dateTimeColumns, dateFormatter), "")
    .match(/[a-z]|[A-Z]|[0-9]|[А-Я]|[а-я]|[-|_]/g)
    .join("");
  const renderThead = () =>
    row.reduce(
      (acc, column) =>
        acc +
        `<th style="${commonStyle}; padding-right: 10px; font-weight: bold;">${headColumnName(
          column,
          verbose_names
        )}</th>`,
      ""
    );

  const renderTBody = () =>
    row.reduce(
      (acc, column) =>
        acc +
        `<td style="${commonStyle}; border: 1px solid #ddd;">${bodyColumnName(
          column,
          dateTimeColumns,
          dateFormatter
        )}</td>`,
      ""
    );
  const THead = `<tr>${renderThead()}</tr>`;
  const TBody =
    multyplaied.length < 1
      ? `<tr class="row${selectClass}">${renderTBody()}</tr>`
      : `${multyplaied.reduce((acc, item) => {
          const { groupby, metric, pointName } = item || {};
          const row = [{ value: pointName }, ...groupby, ...metric];
          const selectClass = row
            .reduce((fullName, column) => fullName + "-" + bodyColumnName(column, dateTimeColumns, dateFormatter), "")
            .match(/[a-z]|[A-Z]|[0-9]|[А-Я]|[а-я]|[-|_]/g)
            .join("");
          return (
            acc +
            `
    <tr class="row${selectClass}">
    ${row.reduce(
      (acc, column) =>
        acc +
        `<td style="${commonStyle}; border: 1px solid #ddd;">${bodyColumnName(
          column,
          dateTimeColumns,
          dateFormatter
        )}</td>`,
      ""
    )}
    </tr>
    `
          );
        }, "")}`;
  const html = `
  <table class="balloon-content-custom">
    <thead>
      ${THead}
    </thead>
    <tbody>
      ${TBody}
    </tbody>
  </table>
`;
  return {
    body: html,
    head: THead,
    row: TBody,
  };
}
export function getPointDataWithDefaultIcon(
  clusterOptionName,
  iconContent,
  hintContent,
  balloonContent,
  placemarkData,
  map_icon,
  items
) {
  return {
    balloonContentBody: balloonContent.body,
    balloonContentHead: balloonContent.head,
    balloonContentRow: balloonContent.row,
    clusterCaption: "<strong>" + clusterOptionName + "</strong>",
    iconContent,
    hintContent,
    placemarkData,
    map_icon,
    items,
  };
}
export function getPointOptions() {
  return { preset: "islands#violetStretchyIcon" };
}
export const getIconContentLayout = () =>
  ymaps.templateLayoutFactory.createClass(
    '<div style="color: #fff; font-weight: bold; width: fit-content; background: black; padding: 1px 3px;">$[properties.iconContent]</div>'
  );
export function getPointOptionsForCustomIcon(iconName) {
  return {
    // Опции.
    // Необходимо указать данный тип макета.
    iconLayout: "default#imageWithContent",
    // Своё изображение иконки метки.
    iconImageHref: `${window?.location.protocol}//${window?.location.host}${iconName}`,
    // Размеры метки.
    iconImageSize: [46, 46],
    // Смещение левого верхнего угла иконки относительно
    // её "ножки" (точки привязки).
    iconImageOffset: [-23, -23],
    // Смещение слоя с содержимым относительно слоя с картинкой.
    iconContentOffset: [52, 14],
    // Макет содержимого.
    iconContentLayout: getIconContentLayout(),
  };
}
function filterPlacemarks(placemarks = [], allPointsInside) {
  return placemarks.filter((placemark) => {
    const x1 = placemark.geometry.getCoordinates()?.[0];
    const y1 = placemark.geometry.getCoordinates()[1];
    return !allPointsInside.find((point) => {
      const x2 = point.geometry.getCoordinates()?.[0];
      const y2 = point.geometry.getCoordinates()[1];
      return x1 === x2 && y1 === y2;
    });
  });
}
//<----------Functions for placemark generation----------
// ----------Functions for Cluster generation---------->
function getClusters(
  bubbleMap,
  placemarks,
  dateFormatter,
  openDrilldown,
  closeDrilldown,
  clearDrilldownCharts,
  info_panels_drilldown,
  slice,
  payload
) {
  const clusterer = new ymaps.Clusterer({
    preset: "islands#invertedVioletClusterIcons",
    clusterDisableClickZoom: true,
    groupByCoordinates: false,
    clusterHideIconOnBalloonOpen: false,
    geoObjectHideIconOnBalloonOpen: false,
    clusterBalloonItemContentLayout: function(options, ...args) {
      const points = options.ownerProperties._sourceDataManager._data.geoObjects;
      const grouped = {};
      let GroupeContent = "";
      for (const item of points) {
        grouped[item.properties._data.hintContent] = grouped[item.properties._data.hintContent] ?? [];
        grouped[item.properties._data.hintContent].push(item);
      }

      const key = options.properties._data.hintContent;
      const currentItem = grouped[key];
      currentItem.forEach((item) => {
        GroupeContent += item.properties._data.balloonContentRow;
      });
      const Content = ymaps.templateLayoutFactory.createClass(
        `
        <div class="cluster-content__header"> ${options.properties._data.clusterCaption}</div>
        <table class="balloon-content-custom">
          <thead>
            ${options.properties._data.balloonContentHead}
          </thead>
          <tbody>
            ${GroupeContent}
          </tbody>
        </table>
      `,
        {
          build: function() {
            this.constructor.superclass.build.call(this);
            currentItem.forEach((item) => {
              const { multyplaied, dateTimeColumns, position, hintContent: pointName } =
                item.properties._data.placemarkData || {};
              multyplaied &&
                multyplaied.forEach((multyplaiedItem) => {
                  const { groupby, metric } = multyplaiedItem || {};
                  const multyplaiedRow = pointName
                    ? [{ value: pointName }, ...groupby, ...metric]
                    : [...groupby, ...metric];
                  const hintContent = item.properties._data.hintContent;
                  addContextEvent(
                    multyplaiedRow,
                    hintContent,
                    position,
                    dateTimeColumns,
                    dateFormatter,
                    slice,
                    payload
                  );
                });
            });
          },
        }
      );
      return new Content(options, ...args);
    },
  });

  clusterer.options.set({
    gridSize: 80,
    clusterDisableClickZoom: true,
    hasBalloon: true,
    hasHint: false,
  });

  clusterer.add(placemarks);
  bubbleMap.geoObjects.add(clusterer);

  if (info_panels_drilldown && openDrilldown) {
    bubbleMapDDVisualization(slice, clusterer);
    drilldownFromCluster(slice, payload, openDrilldown, closeDrilldown, clearDrilldownCharts, clusterer);
  } else bubbleMapDDVisualizationDisable(slice);

  clusterer.events.add("balloonopen", () => {
    const arrayForCheck = {};
    const duplicates = selectAll(".ymaps-2-1-79-b-cluster-tabs__menu-item");
    duplicates.each(function() {
      arrayForCheck[this.innerText] ? this.classList.add("hidden") : (arrayForCheck[this.innerText] = this.innerText);
    });
  });
}
// <----------Functions for Cluster generation----------

// ----------Functions for areas(polygons) generation---------->
function getPolygon(areas, bubbleMap) {
  const regExForColor = /^\#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;
  const polygons = areas.content.map((area) => {
    const coordinates = area.polygon || [];
    const area_name = area.area_name || "";
    const center = area.center || [];
    const color = area.color.trim();
    const fillColor = regExForColor.test(color) ? color : "000000";
    const polygon = new ymaps.Polygon(
      [coordinates],
      {
        hintContent: area_name,
      },
      {
        interactivityModel: "default#transparent",
        fillColor,
        strokeWidth: 1,
        fillOpacity: 0.4,
        opacity: 1,
        strokeColor: "#ffffff",
      }
    );
    return { polygon, center, area_name };
  });
  polygons.forEach((polygon) => bubbleMap.geoObjects.add(polygon.polygon));
  return polygons;
}
async function aggregateAreas(polygons, placemarks, firstMetricName, payload, slice) {
  const { formData } = slice;
  const placemarksData = [];
  const allPointsInside = [];
  const aggregatedPolygons = polygons
    .map((region) => {
      const polygon = region.polygon;
      const center = region.center;
      const area_name = region.area_name;
      const pointsInside = getPointsInside(polygon, placemarks, formData);
      const fields = pointsInside.map((item) => item.fields);
      const points = pointsInside.map((item) => allPointsInside.push(item.point) && item.point);
      placemarksData.push({
        polygon,
        area_name,
        center,
        points,
      });
      return { area_name, center, points: fields };
    })
    .filter((aggregate) => aggregate.points.length > 0);
  const requestData = getRequestData(aggregatedPolygons, firstMetricName, payload, formData);
  const aggregationResult = await getAggregationResult(requestData);
  return { aggregationResult, placemarksData, allPointsInside };
}
export async function createCenters(
  bubbleMap,
  aggregationResult,
  placemarksData,
  slice,
  payload,
  dateFormatter,
  firstMetricName
) {
  const centres = [];
  if (aggregationResult) {
    for (const area_name in aggregationResult) {
      const area = placemarksData.find((data) => data.area_name === area_name) || {};
      const position = area.center || [];
      const polygon = area.polygon || {};
      const centerPoints = area.points;
      const centerItems = [];
      const resultMetric = aggregationResult[area_name]?.metric;
      centerPoints &&
        centerPoints.forEach((centerPoint) => {
          const items = centerPoint.properties.get("items");
          items && items.forEach((item) => centerItems.push(item));
        });
      const feature = [
        {
          position,
          map_icon: null,
          pointName: null,
          area_name,
          metric: [resultMetric],
          items: centerItems,
          polygon,
        },
      ];
      const centre = await getPlacemarks(feature, firstMetricName, dateFormatter, slice, payload);
      polygon.events.add("click", () => {
        bubbleMap.setBounds(polygon.geometry.getBounds(), {
          checkZoomRange: true,
        });
        centerPoints.forEach((placemark) => placemark.options.set("visible", true));
        centre.forEach((placemark) => placemark.options.set("visible", false));
      });
      polygon.events.add("dblclick", () => {
        centerPoints.forEach((placemark) => placemark.options.set("visible", false));
        centre.forEach((placemark) => placemark.options.set("visible", true));
      });
      centerPoints.forEach(
        (placemark) => bubbleMap.geoObjects.add(placemark) && placemark.options.set("visible", false)
      );
      centre.forEach((placemark) => centres.push(placemark) && bubbleMap.geoObjects.add(placemark));
    }
  }
  return centres;
}
export function getRequestData(aggregates, firstMetricName, payload, formData) {
  const { granularity_sqla } = formData;
  const requestData = new URLSearchParams({
    form_data: JSON.stringify({
      ...payload.form_data,
      granularity_sqla,
      metric: firstMetricName,
      aggregates: aggregates,
    }),
  });

  return requestData;
}
export function getPointsInside(polygon, placemarks, formData) {
  const pointsInsidePolygon = [];
  placemarks &&
    placemarks.forEach((feature) => {
      polygon.geometry.contains(feature.geometry.getCoordinates()) && pointsInsidePolygon.push(feature);
    });
  return pointsInsidePolygon.map((point) => {
    const position = point.geometry.getCoordinates();
    const pointName = point.properties.get("hintContent");
    const map_icon = point.properties.get("map_icon");
    const fields = {
      icon_field: {
        field: formData.iconPointer,
        value: map_icon,
      },
      latitude: {
        field: formData.latitude,
        value: position?.[0],
      },
      longitude: {
        field: formData.longitude,
        value: position?.[1],
      },
      pointName: {
        field: formData.pointName,
        value: pointName,
      },
    };
    return { fields, point };
  });
}
async function getAggregationResult(requestData) {
  const URL = `${window?.location.protocol}//${window?.location.host}/superset/aggregate_by_area`;
  const token = $("input#csrf_token").val();
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-CSRF-Token": token,
    },
    body: requestData,
  };
  const response = await fetch(URL, options);
  return response.json();
}
// <----------Functions for areas(polygons) generation----------

//----------Functions for Drilldown generation---------->
function addContextEvent(row, hintContent, position, dateTimeColumns, dateFormatter, slice, payload) {
  const { bubble_map_metrics } = slice.formData;

  const selectClass = row
    .reduce((fullName, column) => fullName + "-" + bodyColumnName(column, dateTimeColumns, dateFormatter), "")
    .match(/[a-z]|[A-Z]|[0-9]|[А-Я]|[а-я]|[-|_]/g)
    .join("");
  let table;
  const isPopap = regExpDrillDown.test(slice.containerId);

  if (isPopap) {
    table = d3.selectAll(
      `#slice_${slice.formData.slice_id}_drilldown .balloon-content-custom tbody tr.row${selectClass} td`
    );
  } else {
    table = d3.selectAll(`.balloon-content-custom tbody tr.row${selectClass} td`);
  }
  table
    .data(() =>
      row.map((c) => {
        let value = c.value;
        let html;
        const isMetric = bubble_map_metrics.some((metric) =>
          typeof metric === "string" ? metric === c.name : metric.label === c.name
        );
        if (dateTimeColumns.indexOf(c.name) > -1) {
          html = `<div>${dateFormatter(value)}</div>`;
        } else if (isMetric) {
          html = `<div>${slice.d3format(c.name, value)}</div>`;
        } else if (c.name?.[0] === "%") {
          html = `<div>${d3.format(".3p")(value)}</div>`;
        } else {
          html = `<span class="like-pre">${value}</span>`;
        }
        const data = {
          col: c.name,
          val: value,
          html,
          isMetric,
          row,
          hintContent,
          position,
        };
        const isMenu = setMenu(slice, payload)(data).length;

        if (isMenu) {
          html = html.replace(regExp, `<div class='isContextMenu'>`);
        }

        return {
          col: c.name,
          val: value,
          html,
          isMetric,
          row,
          hintContent,
          position,
        };
      })
    )
    .on("contextmenu", (data) => {
      const items = setMenu(slice, payload)(data);
      if (items.length) {
        d3.contextMenu(() => items)();
      }
    });

  if (table) addContextMenuCursorToBalloon(table, slice, isPopap);
}

async function drilldownFromPlacemark(slice, payload, openDrilldown, closeDrilldown, clearDrilldownCharts, placemarks) {
  placemarks.forEach((placemark) => {
    placemark.events.add("contextmenu", (e) => {
      const formData = slice.formData;
      const items = placemark.properties._data.items || {};
      const clearActivePlacemarks = () => placemarks.forEach((point) => clearActivePonits(point));
      clearActivePlacemarks();
      selectPlacemark(placemark);
      $(".d3-context-menu").remove();
      const sliceFilters = formData.filters;
      const contextFilters = [];
      const allFilters = [];
      const urls = slice.formData.url_drilldowns;
      const urlDrilldowns = slice.formData.url_drilldowns.filter((dd) => {
        const drilldown = slice.formData.url_drilldowns.find((item) => item.title === dd.title) || {};
        return drilldown.type === "dashboards" && drilldown.drilldownToInfoPanel;
      });

      items.forEach((items) => {
        const { groupby, pointName, position } = items;
        getContextFilters(groupby, position, pointName, slice, allFilters);
      });
      allFilters.forEach((filter) => {
        if (!contextFilters.find((contextFilter) => contextFilter.col === filter.col)) {
          contextFilters.push(filter);
        } else {
          const currentFilter = contextFilters.find((contextFilter) => contextFilter.col === filter.col);
          !currentFilter.val.includes(filter.val[0]) && (currentFilter.val = [...currentFilter.val, ...filter.val]);
        }
      });
      const menuHead = `<li class=" is-header">${t("URL Drilldowns")}</li>`;
      const menuLinks = urlDrilldowns.reduce(
        (acc, drilldown) =>
          acc +
          `<li class="drilldownLink-${
            typeof drilldown.title === "string" ? drilldown.title.replace(/\s+/g, "").trim() : drilldown.title
          }"> ${drilldown.title} </li>`,
        ""
      );
      const menuContent = `
              <div class="d3-context-menu">
                <ul>
                  ${menuHead}
                  ${menuLinks}
                </ul>
              </div>
            `;
      $("body").append(menuContent);

      for (let drilldown of urlDrilldowns) {
        const selector =
          typeof drilldown.title === "string" ? drilldown.title.replace(/\s+/g, "").trim() : drilldown.title;
        $(`.drilldownLink-${selector}`).on("click", async () => {
          if (window.location.pathname.includes("superset/dashboard")) {
            closeDrilldown && closeDrilldown();
            clearDrilldownCharts && clearDrilldownCharts();
            contextFilters.forEach((filter) => (filter.op = "in"));
            getTimefilter(formData, payload, contextFilters);
            const wheres = getWheres([formData.where, payload.form_data.where]);
            const left = e.get("pagePixels")[0];
            const top = e.get("pagePixels")[1];
            const request = urls
              .map(
                (url) =>
                  url.type === "dashboards" &&
                  url.title === drilldown.title &&
                  url.url &&
                  fetch(`/superset/dashboard/${url.url}/?json=true`)
              )
              .filter((item) => item);

            Promise.all(request)
              .then((response) => Promise.all(response.map((r) => r.json())))
              .then((data) => data.map((i) => getInitialState(i, true)))
              .then((drilldownData) => {
                drilldownData.forEach((data) => {
                  const dashboardFilters = {};
                  data.charts &&
                    Object.keys(data.charts).forEach(
                      (chart, i) => i === 0 && (dashboardFilters[chart] = [...contextFilters, ...sliceFilters])
                    );
                  data.dashboard.filters = {
                    ...data.dashboard.filters,
                    ...dashboardFilters,
                  };
                });
                return openDrilldown && openDrilldown(left, top, drilldownData, wheres, clearActivePlacemarks);
              });
          }
          $(".d3-context-menu").remove();
        });
      }

      $(".d3-context-menu").css({
        display: "block",
        left: e.get("pagePixels")[0],
        top: e.get("pagePixels")[1],
      });
      $("body").on("click", () => $(".d3-context-menu").remove());
    });
  });
}
async function drilldownFromCluster(slice, payload, openDrilldown, closeDrilldown, clearDrilldownCharts, clusterer) {
  clusterer.events.add("contextmenu", (e) => {
    const formData = slice.formData;
    const cluster = e.get("target");
    if (cluster.options.getName() === "cluster") {
      const clearActiveClusters = () => clusterer.getClusters().forEach((point) => clearActivePonits(point));
      clearActiveClusters();
      cluster.options.set("iconColor", "#000fff");

      $(".d3-context-menu").remove();
      const placemarks = cluster.properties.get("geoObjects");
      const sliceFilters = formData.filters;
      const contextFilters = [];
      const allFilters = [];
      const urlDrilldowns = slice.formData.url_drilldowns.filter((dd) => {
        const drilldown = slice.formData.url_drilldowns.find((item) => item.title === dd.title) || {};
        return drilldown.type === "dashboards" && drilldown.drilldownToInfoPanel;
      });

      placemarks.forEach((placemark) => {
        const { groupby, position, hintContent } = placemark?.properties?._data?.placemarkData || {};
        getContextFilters(groupby, position, hintContent, slice, allFilters);
      });
      allFilters.forEach((filter) => {
        if (!contextFilters.find((contextFilter) => contextFilter.col === filter.col)) {
          contextFilters.push(filter);
        } else {
          const currentFilter = contextFilters.find((contextFilter) => contextFilter.col === filter.col);
          !currentFilter.val.includes(filter.val[0]) && (currentFilter.val = [...currentFilter.val, ...filter.val]);
        }
      });
      const menuHead = `<li class=" is-header">${t("URL Drilldowns")}</li>`;
      const menuLinks = urlDrilldowns.reduce(
        (acc, drilldown) =>
          acc +
          `<li class="drilldownLink-${
            typeof drilldown.title === "string" ? drilldown.title.replace(/\s+/g, "").trim() : drilldown.title
          }"> ${drilldown.title} </li>`,
        ""
      );
      const menuContent = `
            <div class="d3-context-menu">
              <ul>
                ${menuHead}
                ${menuLinks}
              </ul>
            </div>
          `;
      $("body").append(menuContent);
      for (let drilldown of urlDrilldowns) {
        const selector =
          typeof drilldown.title === "string" ? drilldown.title.replace(/\s+/g, "").trim() : drilldown.title;
        $(`.drilldownLink-${selector}`).on("click", async () => {
          if (window.location.pathname.includes("superset/dashboard")) {
            closeDrilldown && closeDrilldown();
            clearDrilldownCharts && clearDrilldownCharts();
            contextFilters.forEach((filter) => (filter.op = "in"));
            getTimefilter(formData, payload, contextFilters);
            const wheres = getWheres([formData.where, payload.form_data.where]);
            const left = e.get("pagePixels")[0];
            const top = e.get("pagePixels")[1];
            const urls = slice.formData.url_drilldowns;

            const requests = urls
              .map(
                (url) =>
                  url.type === "dashboards" &&
                  url.title === drilldown.title &&
                  url.url &&
                  fetch(`/superset/dashboard/${url.url}/?json=true`)
              )
              .filter((item) => item);
            Promise.all(requests)
              .then((response) => Promise.all(response.map((r) => r.json())))
              .then((data) => data.map((i) => getInitialState(i, true)))
              .then((drilldownData) => {
                drilldownData.forEach((data) => {
                  const dashboardFilters = {};
                  const charts = data.charts;
                  charts &&
                    Object.keys(charts).forEach(
                      (key, i) => i === 0 && (dashboardFilters[key] = [...contextFilters, ...sliceFilters])
                    );
                  data.dashboard.filters = {
                    ...data.dashboard.filters,
                    ...dashboardFilters,
                  };
                });
                return openDrilldown && openDrilldown(left, top, drilldownData, wheres, clearActiveClusters);
              });
          }
          $(".d3-context-menu").remove();
        });
      }

      $(".d3-context-menu").css({
        display: "block",
        left: e.get("pagePixels")[0],
        top: e.get("pagePixels")[1],
      });
      $("body").on("click", () => $(".d3-context-menu").remove());
    }
  });
}
export function setMenu(slice, payload) {
  return (data, includeUrlDrilldowns = true) => {
    let columnName = data;
    let columnValue = null;
    if (typeof data === "object" && !Array.isArray(data)) {
      columnName = data.col;
      // if clicked row value
      if (!data.isMetric) columnValue = data.val;
    }
    let attr = !!slice.formData?.groupby?.length ? (attr = "groupby") : "all_columns";
    const hierarcyManager = new Hierarchy(slice, payload);
    const contextFilters = [];
    const filterColumns = slice.formData[attr] || [];
    const positions = data.position || [];
    filterColumns.forEach((column) => {
      if (!data.row) {
        // header click
        return;
      }
      const filteredColumn = data.row.find((item) => item.name === column);
      const count = data.row.find((item) => item.name === "count");

      contextFilters.push({
        col: column,
        val: filteredColumn?.value,
        count: count?.value,
      });
    });
    positions.forEach((position, index) => {
      const columnName = position && index !== 0 ? slice.formData?.longitude : slice.formData?.latitude;
      position && contextFilters.push({ col: columnName, val: position });
    });

    contextFilters.push({
      col: slice.formData?.pointName,
      val: data.hintContent,
    });

    const urlDrilldowns = includeUrlDrilldowns ? hierarcyManager.getUrlDrilldowns(columnName, contextFilters) : [];
    const hierarchyDrilldowns = [];
    payload.hierarchy.forEach((hierarchyItem) => {
      const attr = (slice.formData.groupby || []).length ? "groupby" : "all_columns";

      const currentHierarchyDrilldown = [];
      const mapColumnToDrilldown = (hierarchyColumn) => {
        const columnIndexFormData = slice.formData[attr]?.indexOf(hierarchyColumn.name);
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
                    for (const item of data.row) {
                      if (metrics.includes(item.name)) {
                        continue;
                      }
                      hierarchyContextFilters.push({
                        col: item.name,
                        op: "in",
                        val: [data.row?.value],
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
                    hierarchyItem.columns
                  );
                },
        };
        return drilldown;
      };

      if (!slice.formData[attr]?.length && hierarchyItem.columns?.[0]) {
        const nextColumn = hierarcyManager.getNextColumnByHierarchy(hierarchyItem, hierarchyItem.columns?.[0]);
        if (nextColumn) {
          currentHierarchyDrilldown.push(mapColumnToDrilldown(nextColumn));
        }
      } else {
        // Если есть, для каждого ищется следующий по иерархии
        const nextColumns = hierarchyItem.columns
          .filter((hierarchyColumn) => slice.formData[attr].includes(hierarchyColumn.name))
          .map((hierarchyColumn) => hierarcyManager.getNextColumnByHierarchy(hierarchyItem, hierarchyColumn))
          .filter((item) => item);
        nextColumns // Если найденный следующий уже присутствует в группировке - его не предлагать
          .forEach((item) => {
            currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
          });
      }

      if (currentHierarchyDrilldown.length) {
        hierarchyItem.columns.forEach((column) => {
          if ((column.name || column.verbose_name) === columnName) {
            hierarchyDrilldowns.push({
              title: hierarchyItem.verbose_name || hierarchyItem.name,
            });
            currentHierarchyDrilldown.forEach((item) => {
              hierarchyDrilldowns.push(item);
            });
          }
        });
      }
    });

    return data.isMetric ? [...urlDrilldowns] : [...hierarchyDrilldowns, ...urlDrilldowns];
  };
}
export function getContextFilters(groupby, position, hintContent, slice, contextFilters) {
  const formData = slice.formData;
  groupby &&
    groupby.forEach((item) =>
      contextFilters.push({
        col: item.name,
        val: [item.value],
      })
    );

  contextFilters.push({
    col: formData?.pointName,
    val: [hintContent],
  });
  position &&
    position.forEach((position, index) => {
      const columnName = position && index !== 0 ? formData?.longitude : formData?.latitude;
      position && contextFilters.push({ col: columnName, val: [position] });
    });
}
function getTimefilter(formData, payload, contextFilters) {
  const timeRestrictionKey = formData.granularity_sqla;
  let { from_dttm, to_dttm } = payload.form_data;
  const findFromDttmAndToDttm = (filter, colName) => filter.col === colName;
  const fromExtraFilter =
    formData.extra_filters && formData.extra_filters.find((filter) => findFromDttmAndToDttm(filter, "__from"));
  const toExtraFilter =
    formData.extra_filters && formData.extra_filters.find((filter) => findFromDttmAndToDttm(filter, "__to"));
  const dateFormatter = (date) => moment(date).format("YYYY-MM-DD HH:mm:ss");
  from_dttm = fromExtraFilter ? dateFormatter(fromExtraFilter.val) : from_dttm;
  to_dttm = toExtraFilter
    ? toExtraFilter.val === "now"
      ? dateFormatter(Date.now())
      : dateFormatter(toExtraFilter.val)
    : to_dttm;
  [from_dttm, to_dttm].forEach((d, i) => {
    if (d) {
      contextFilters.push({
        op: i === 0 ? ">=" : "<=",
        conjuction: "and",
        col: timeRestrictionKey,
        val: d,
      });
    }
  });
}

function selectPlacemark(placemark) {
  const isPointCustom = placemark.options.get("iconLayout");
  isPointCustom === "default#imageWithContent"
    ? placemark.options.unset("iconLayout") && placemark.options.set("preset", "islands#redDotIcon")
    : placemark.options.set("iconColor", "#ff0000");
}
function clearActivePonits(point) {
  const isPointCustom = point.options.get("iconLayout") === "default#imageWithContent";
  const selected = Array.isArray(point.options.get("preset"))
    ? point.options.get("preset")[0] === "islands#redDotIcon"
    : point.options.get("preset") === "islands#redDotIcon";
  isPointCustom || selected
    ? point.options.set("iconLayout", "default#imageWithContent")
    : point.options.unset("iconColor");
}
// <----------Functions for Drilldown generation----------

//----------utils---------->
export function getIsPositionNotCorrect(position) {
  return !Array.isArray(position) || !position?.[0] || !position[1];
}
export function getLatLongCenter(features) {
  const extremeCoords = Array.isArray(features)
    ? features.reduce(
        (acc, item, index) => {
          const position = item?.position || [];
          const isPositionNotCorrect = getIsPositionNotCorrect(position);
          if (isPositionNotCorrect) {
            return acc;
          }
          if (index === 0) {
            acc.lat[0] = position[0];
            acc.lat[1] = position[0];
            acc.long[0] = position[1];
            acc.long[1] = position[1];
            return acc;
          }
          if (acc.lat[0] > position[0]) {
            acc.lat[0] = position[0];
          }
          if (acc.lat[1] < position[0]) {
            acc.lat[1] = position[0];
          }
          if (acc.long[0] > position[1]) {
            acc.long[0] = position[1];
          }
          if (acc.long[1] < position[1]) {
            acc.long[1] = position[1];
          }
          return acc;
        },
        {
          lat: [0, 0],
          long: [0, 0],
        }
      )
    : {
        lat: [0, 0],
        long: [0, 0],
      };
  const latCenter = Number(((extremeCoords.lat[0] + extremeCoords.lat[1]) / 2).toFixed(5));
  const longCenter = Number(((extremeCoords.long[0] + extremeCoords.long[1]) / 2).toFixed(5));
  const center = [latCenter, longCenter];

  return center;
}
export async function CheckImageUrl(map_icon) {
  const imageUrl = `${window?.location.protocol}//${window?.location.host}${map_icon}`;
  return map_icon
    ? fetch(imageUrl)
        .then((res) => res.ok)
        .catch((error) => {
          console.log(error, "error");
          return false;
        })
    : false;
}
// <----------utils----------

export default bubbleMap;
