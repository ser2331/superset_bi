import d3 from "d3";
import contextmenu from "d3-context-menu";
import { t } from "../javascripts/locales";
import "./yandex_heat_map.css"

contextmenu(d3);

const GRADIENTS = [
  {
    '0.1': 'red',
    '0.5': 'orange',
    '0.7': 'yellow',
    '1': 'lime',
  },
  {
    '0.1': 'lime',
    '0.5': 'yellow',
    '0.7': 'orange',
    '1': 'red',
  }
];

const yandex_heat_map = (slice, payload) => {
  const { formData } = slice
  let {
    zoom = 3,
    bubble_map_metrics,
    opacity,
    show_controls,
    show_legend,
    legend_number_format,
    radius,
    gradient,
    heatmapIsShown,
    dissipating,
  } = formData || {};
  const { data } = payload

  let width = slice.width();
  let height = slice.height();

  if (width > height) {
    width = height
  } else {
    height = width
  }
  const bubbleContainerId = `bubble-${slice.containerId}`

  // create bubble map container
  const sliceContainer = d3.select(`#${slice.containerId}`)
  const isDashBoard = window.location.pathname.includes("superset/dashboard")
  const heightValue = isDashBoard ? "90%" : `${height}px`
  const witdthValue = isDashBoard ? "100%" : `${width}px`

  sliceContainer.selectAll("*").remove()
  sliceContainer
    .append("div")
    .classed("bubble-chart", true)
    .attr("id", bubbleContainerId)
    .attr("key", Date.now())
    .style("textAlign", "center")
    .style("height", heightValue)
    .style("width", witdthValue)

  const verbose_names = slice.datasource.verbose_map
  const props = {
    bubbleContainerId,
    formData: {
      zoom,
      show_controls,
      opacity,
      radius,
      gradient,
      heatmapIsShown,
      dissipating,
      show_legend,
      bubble_map_metrics,
      legend_number_format,
      verbose_names
    },
    features: data?.features || [],
    legend : data?.legend || [],
  }
    renderBubbleMap(props)
};

function renderBubbleMap(props) {
  const { bubbleContainerId, formData, features, legend } = props;
  const { zoom, show_legend, legend_number_format } = formData;
  const center = getLatLongCenter(features);
  ymaps.ready(function(){
    const bubbleMap = new ymaps.Map(
      bubbleContainerId,
      {
        center,
        zoom,
        behaviors: ["default", "scrollZoom"],
        controls: [
          "rulerControl",
          "typeSelector",
          "zoomControl",
          "fullscreenControl",
        ]
      },
      {
        searchControlProvider: "yandex#search",
        minZoom: 2,
      }
    );
    const points = {
      type: 'FeatureCollection',
      features: getPoints(features)
    };
    renderHeatMap(bubbleMap, bubbleContainerId, points, formData);
    show_legend && createLegend(bubbleMap, formData, legend, legend_number_format);
  }) 
};

export function getPoints(features) {
  const points = features
    ? features
        .map((feature, index) => {
          const { position = [], metric } = feature;
          const isPositionNotCorrect = getIsPositionNotCorrect(position);
          if (isPositionNotCorrect) {
            return;
          }
          return {
            id: `id${index}`,
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: position,
            },
            properties: {
              weight: metric[0]?.value,
            },
          };
        })
        .filter((point) => Boolean(point))
    : [];
  return points;
};

function renderHeatMap(map, bubbleContainerId, points, formData){
  const { opacity, show_controls, radius, gradient, heatmapIsShown, dissipating } = formData;
  ymaps.modules.require(['Heatmap'], function (Heatmap) {
    const heatmap = new Heatmap(points);
    heatmapIsShown && heatmap.setMap(map);
    heatmap.options.set('radius', radius);
    heatmap.options.set('opacity', opacity / 100);
    heatmap.options.set('gradient', gradient ? GRADIENTS[0] : GRADIENTS[1]);
    heatmap.options.set('intensityOfMidpoint', 1.0);
    heatmap.options.set('dissipating', !dissipating);
    addButtons(map, show_controls, heatmap, bubbleContainerId);
  });
};

function addButtons(map, show_controls, heatmap, bubbleContainerId){
    const buttons = [
      {
        name : 'Heatmap',
        action : () => toggleHeatmap(heatmap, map)
      },
      {
        name : 'Dissipating',
        action : () => toggleDissipating(heatmap)
      },
      {
        name : 'Opacity',
        action : () => changeOpacity(heatmap)
      },
      {
        name : 'Gradient',
        action : () => changeGradient(heatmap, bubbleContainerId)
      },
      {
        name : 'Radius',
        action : () => changeRadius(heatmap)
      }
    ]
    .map(( item, index ) => {
      const button =  new ymaps.control.Button(
      {
        data: {
            content: t(item.name),
        },
        options: {
          maxWidth: 160,
          fontSize: 20,
          visible: show_controls,
          selectOnClick: false,
          position: getButtonPosition(index),
        }
      });
      button.events.add('click', item.action);
      return button;
    });

    buttons.forEach(( button ) => map.controls.add(button));
};

function toggleDissipating(heatmap){
   heatmap.options.get('dissipating') ? heatmap.options.set('dissipating', false) : heatmap.options.set('dissipating', true);
};

function toggleHeatmap(heatmap, map){
  heatmap.getMap() ? heatmap.destroy() : heatmap.setMap(map);
};

function changeOpacity(heatmap){
  const step = 0.1;
  let currentOpacity = heatmap.options.get('opacity');
  currentOpacity < 1 ? heatmap.options.set('opacity', currentOpacity + step) : heatmap.options.set('opacity', 0.1);
};

function changeRadius(heatmap){
  const step = 1;
  let currentRadius = heatmap.options.get('radius');
  currentRadius < 21 ? heatmap.options.set('radius', currentRadius + step) : heatmap.options.set('radius', 10);
};

function changeGradient(heatmap, bubbleContainerId){
  const gradientIsReversed = !(heatmap.options.get('gradient')[0.1] === 'lime');
  gradientIsReversed
    ? heatmap.options.set('gradient', GRADIENTS[1])
    : heatmap.options.set('gradient', GRADIENTS[0]);
  const gradientBar = d3.select(`#${bubbleContainerId} .customControl-bar`);
  gradientIsReversed
    ? gradientBar.classed('reversed', false)
    : gradientBar.classed('reversed', true);
};

export function getButtonPosition(index){
  const position = {
    top: index ? 60 + 40 * index : 60,
    right: 10,
  };
  return position; 
};

export function getIsPositionNotCorrect(position) {
  return !Array.isArray(position) || !position[0] || !position[1];
};

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
  const latCenter = Number(
    ((extremeCoords.lat[0] + extremeCoords.lat[1]) / 2).toFixed(5)
  );
  const longCenter = Number(
    ((extremeCoords.long[0] + extremeCoords.long[1]) / 2).toFixed(5)
  );
  const center = [latCenter, longCenter];

  return center;
};

export function createLegend(bubbleMap, formData, legend, legend_number_format){
  const CustomControl = function (options) {
    CustomControl.superclass.constructor.call(this, options);
  };
  // И наследование от collection.Item.
  ymaps.util.defineClass(CustomControl, ymaps.collection.Item, {
    onAddToMap: function(map) {
      CustomControl.superclass.onAddToMap.call(this, map);
      // Создание HTML-элемента с текстом.
      this.getParent()
        .getChildElement(this)
        .then(this._onChildElementGet, this);
    },

    onRemoveFromMap: function(oldMap) {
      CustomControl.superclass.onRemoveFromMap.call(this, oldMap);
    },

    _onChildElementGet: function(parentElementContainer) {
      const { verbose_names, bubble_map_metrics, gradient } = formData;
      let name = bubble_map_metrics;
      const gradientClass = gradient
        ? 'customControl-bar reversed'
        : 'customControl-bar';
      typeof name === 'string' && (name = verbose_names[name]);
      const { avg_val, max_val, min_val } = Object.values(legend)[0];
      const f = d3.format(legend_number_format);
      let html = `
          <div class="customControl">
            <div class="customControl-legend"> ${
              typeof name === 'string' ? name : name.label
            } </div>
            <div class="${gradientClass}"></div>
            <div class="customControl-minmax">
              <div className="customControl-min"> ${f(min_val)} </div>
              <div className="customControl-avarage"> ${f(avg_val)} </div>
              <div className="customControl-max"> ${f(max_val)} </div>
            </div>
          </div>
          `;
      this.content = $(html).appendTo(parentElementContainer);
    },
  });
  const customControl = new CustomControl();
  bubbleMap.controls.add(customControl, {
  float: 'none',
  position: {
      top: 10,
      left: 10
  }});
};

export default yandex_heat_map;
