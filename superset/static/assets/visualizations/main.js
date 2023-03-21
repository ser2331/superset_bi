// eslint-disable-next-line import/no-named-as-default-member
import nvd3Vis from "./nvd3_vis"
import VIZ_TYPES from "./viz_types"
import bigNumber from "./big_number"
import calHeatmap from "./cal_heatmap"
import directedForce from "./directed_force"
import chord from "./chord"
import filterBox from "./filter_box"
import heatmap from "./heatmap"
import histogram from "./histogram"
import horizon from "./horizon"
import iframe from "./iframe"
import mapbox from "./mapbox"
import markup from "./markup"
import parallelCoordinates from "./parallel_coordinates"
import pivotTable from "./pivot_table"
import sankey from "./sankey"
import sunburst from "./sunburst"
import table from "./table"
import timeTable from "./time_table"
import treemap from "./treemap"
import countryMap from "./country_map"
import wordCloud from "./word_cloud"
import worldMap from "./world_map"
import EventFlow from "./EventFlow"
import pairedTtest from "./paired_ttest"
import partition from "./partition"
import scatter from "./deckgl/layers/scatter"
import screengrid from "./deckgl/layers/screengrid"
import grid from "./deckgl/layers/grid"
import hex from "./deckgl/layers/hex"
import path from "./deckgl/layers/path"
import geojson from "./deckgl/layers/geojson"
import arc from "./deckgl/layers/arc"
import polygon from "./deckgl/layers/polygon"
import multi from "./deckgl/multi"
import rose from "./rose"
import speedometer from "./speedometer"
import bubbleMap from "./bubble_map"
import yandex_heat_map from "./yandex_heat_map"

// You ***should*** use these to reference viz_types in code

const vizMap = {
  [VIZ_TYPES.area]: nvd3Vis,
  [VIZ_TYPES.bar]: nvd3Vis,
  [VIZ_TYPES.big_number]: bigNumber,
  [VIZ_TYPES.big_number_total]: bigNumber,
  [VIZ_TYPES.box_plot]: nvd3Vis,
  [VIZ_TYPES.bubble]: nvd3Vis,
  [VIZ_TYPES.bubble_map]: bubbleMap,
  [VIZ_TYPES.yandex_heat_map]: yandex_heat_map,
  [VIZ_TYPES.bullet]: nvd3Vis,
  [VIZ_TYPES.cal_heatmap]: calHeatmap,
  [VIZ_TYPES.compare]: nvd3Vis,
  [VIZ_TYPES.directed_force]: directedForce,
  [VIZ_TYPES.chord]: chord,
  [VIZ_TYPES.dist_bar]: nvd3Vis,
  [VIZ_TYPES.filter_box]: filterBox,
  [VIZ_TYPES.heatmap]: heatmap,
  [VIZ_TYPES.histogram]: histogram,
  [VIZ_TYPES.horizon]: horizon,
  [VIZ_TYPES.iframe]: iframe,
  [VIZ_TYPES.line]: nvd3Vis,
  [VIZ_TYPES.time_pivot]: nvd3Vis,
  [VIZ_TYPES.mapbox]: mapbox,
  [VIZ_TYPES.markup]: markup,
  [VIZ_TYPES.para]: parallelCoordinates,
  [VIZ_TYPES.pie]: nvd3Vis,
  [VIZ_TYPES.pivot_table]: pivotTable,
  [VIZ_TYPES.sankey]: sankey,
  [VIZ_TYPES.separator]: markup,
  [VIZ_TYPES.sunburst]: sunburst,
  [VIZ_TYPES.table]: table,
  [VIZ_TYPES.time_table]: timeTable,
  [VIZ_TYPES.treemap]: treemap,
  [VIZ_TYPES.country_map]: countryMap,
  [VIZ_TYPES.word_cloud]: wordCloud,
  [VIZ_TYPES.world_map]: worldMap,
  [VIZ_TYPES.dual_line]: nvd3Vis,
  [VIZ_TYPES.event_flow]: EventFlow,
  [VIZ_TYPES.paired_ttest]: pairedTtest,
  [VIZ_TYPES.partition]: partition,
  [VIZ_TYPES.deck_scatter]: scatter,
  [VIZ_TYPES.deck_screengrid]: screengrid,
  [VIZ_TYPES.deck_grid]: grid,
  [VIZ_TYPES.deck_hex]: hex,
  [VIZ_TYPES.deck_path]: path,
  [VIZ_TYPES.deck_geojson]: geojson,
  [VIZ_TYPES.deck_arc]: arc,
  [VIZ_TYPES.deck_polygon]: polygon,
  [VIZ_TYPES.deck_multi]: multi,
  [VIZ_TYPES.rose]: rose,
  [VIZ_TYPES.speedometer]: speedometer,
}
export default vizMap
