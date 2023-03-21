/* eslint camelcase: 0 */
import PropTypes from "prop-types"

import { now } from "../modules/dates"
import * as actions from "./chartAction"
import * as dashboardActions from "../dashboard/actions"
import { t } from "../locales"
import { applyDefaultFormData } from "../explore/stores/store"

export const chartPropType = {
  chartKey: PropTypes.string.isRequired,
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number,
  latestQueryFormData: PropTypes.object,
  queryRequest: PropTypes.object,
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  lastRendered: PropTypes.number,
}

export const chart = {
  chartKey: "",
  chartAlert: null,
  chartStatus: "loading",
  chartUpdateEndTime: null,
  chartUpdateStartTime: now(),
  latestQueryFormData: {},
  queryRequest: null,
  queryResponse: null,
  triggerQuery: true,
  lastRendered: 0,
}

export default function chartReducer(charts = {}, action) {
  const actionHandlers = {
    [actions.CHART_UPDATE_SUCCEEDED](state) {
      // put data chart ro redux
      const updateSucceededData =
        action.queryResponse.form_data.allow_run_async &&
        state.chartStatus === "rendered"
          ? { ...state }
          : {
              ...state,
              chartStatus: "success",
              queryResponse: action.queryResponse,
              chartUpdateEndTime: now(),
            }
      if(!updateSucceededData.formData && !updateSucceededData.form_data){
        updateSucceededData.formData = action.queryResponse.form_data
        updateSucceededData.form_data = action.queryResponse.form_data
        updateSucceededData.slice_id = action.queryResponse.form_data.slice_id
        updateSucceededData.chartKey = action.key
      }
      return {
        ...updateSucceededData,
      }
    },
    [actions.CHART_UPDATE_STARTED](state) {
      return {
        ...state,
        chartStatus: "loading",
        chartAlert: null,
        chartUpdateEndTime: null,
        chartUpdateStartTime: now(),
        queryRequest: action.queryRequest,
      }
    },
    [actions.CHART_UPDATE_STOPPED](state) {
      return {
        ...state,
        chartStatus: "stopped",
        chartAlert: t("Updating chart was stopped"),
      }
    },
    [actions.CHART_RENDERING_SUCCEEDED](state) {
      return { ...state, chartStatus: "rendered" }
    },
    [actions.CHART_RENDERING_FAILED](state) {
      return {
        ...state,
        chartStatus: "failed",
        chartAlert: t(
          "An error occurred while rendering the visualization: %s",
          action.error
        ),
      }
    },
    [actions.CHART_UPDATE_TIMEOUT](state) {
      return {
        ...state,
        chartStatus: "failed",
        chartAlert:
          `${t("Query timeout")} - ` +
          t(
            "visualization queries are set to timeout at %s seconds. ",
            action.timeout
          ) +
          t(
            "Perhaps your data has grown, your database is under unusual load, " +
              "or you are simply querying a data source that is too large " +
              "to be processed within the timeout range. " +
              "If that is the case, we recommend that you summarize your data further."
          ),
      }
    },
    [actions.CHART_UPDATE_FAILED](state) {
      return {
        ...state,
        chartStatus: "failed",
        chartAlert: action.queryResponse
          ? action.queryResponse.error
          : t("Network error."),
        chartUpdateEndTime: now(),
        queryResponse: action.queryResponse,
      }
    },
    [actions.TRIGGER_QUERY](state) {
      return { ...state, triggerQuery: action.value }
    },
    [actions.RENDER_TRIGGERED](state) {
      return { ...state, lastRendered: action.value }
    },
    [actions.UPDATE_QUERY_FORM_DATA](state) {
      return { ...state, latestQueryFormData: action.value }
    },
    [actions.ANNOTATION_QUERY_STARTED](state) {
      if (
        state.annotationQuery &&
        state.annotationQuery[action.annotation.name]
      ) {
        state.annotationQuery[action.annotation.name].abort()
      }
      const annotationQuery = {
        ...state.annotationQuery,
        [action.annotation.name]: action.queryRequest,
      }
      return {
        ...state,
        annotationQuery,
      }
    },
    [actions.ANNOTATION_QUERY_SUCCESS](state) {
      const annotationData = {
        ...state.annotationData,
        [action.annotation.name]: action.queryResponse.data,
      }
      const annotationError = { ...state.annotationError }
      delete annotationError[action.annotation.name]
      const annotationQuery = { ...state.annotationQuery }
      delete annotationQuery[action.annotation.name]
      return {
        ...state,
        annotationData,
        annotationError,
        annotationQuery,
      }
    },
    [actions.ANNOTATION_QUERY_FAILED](state) {
      const annotationData = { ...state.annotationData }
      delete annotationData[action.annotation.name]
      const annotationError = {
        ...state.annotationError,
        [action.annotation.name]: action.queryResponse
          ? action.queryResponse.error
          : t("Network error."),
      }
      const annotationQuery = { ...state.annotationQuery }
      delete annotationQuery[action.annotation.name]
      return {
        ...state,
        annotationData,
        annotationError,
        annotationQuery,
      }
    },
    [actions.SAVE_SLICE_STATE](state) {
      // TODO: Почему latestQueryFormData?
      // По каким правилами обновляются эти три поля
      // в formData, form_data и latestQueryFormData?
      // Почему они не синхронны?
      const prevFormData = {
        formData: state.latestQueryFormData,
        filters: [...(state.latestQueryFormData.filters || [])],
        groupby: [...(state.latestQueryFormData.groupby || [])],
        columns: [...(state.latestQueryFormData.columns || [])],
      }
      return {
        ...state,
        prevFormData: [prevFormData, ...(state.prevFormData || [])],
      }
    },
    [actions.REVERT_SLICE_STATE](state) {
      const [lastState, ...prevFormData] = state.prevFormData
      return {
        ...state,
        formData: {
          ...lastState.formData,
          filters: [...lastState.filters],
          groupby: [...lastState.groupby],
          columns: [...(lastState.columns || [])],
        },
        form_data: {
          // WTF?? Почему их две и они частично не совпадают?! Памагите!
          ...lastState.formData,
          filters: [...lastState.filters],
          groupby: [...lastState.groupby],
          columns: [...(lastState.columns || [])],
        },
        prevFormData,
      }
    },
    [actions.DRILLDOWN_TO_SLICE](state) {
      return {
        ...state,
        formData: action.formData,
        form_data: action.formData,
      }
    }
  }

  /* eslint-disable no-param-reassign */
  if (action.type === actions.REMOVE_CHART) {
    delete charts[action.key]
    return charts
  }

  if (action.type === actions.ADD_CHARTS) {
    const { slices } = action
    const initCharts = {}
    slices.forEach(({ form_data: slice }) => {
      const chartKey = `slice_${slice.slice_id}`
      initCharts[chartKey] = {
        ...chart,
        chartKey,
        slice_id: slice.slice_id,
        form_data: slice,
        formData: applyDefaultFormData(slice),
      }
    })
    return {
      ...charts,
      ...initCharts,
    }
  }

  if (action.type === actions.CLEAR_DRILLDOWN_CHARTS) {
    const newCharts = {};
    for (const chart in charts) {
      !chart.includes('drilldown') && (newCharts[chart] = charts[chart]);
    }
    return newCharts;
  }

  if (action.type in actionHandlers) {
    return action.drilldown
      ? {
          ...charts,
          [`${action.key}_drilldown`]: actionHandlers[action.type](
            charts[`${action.key}_drilldown`],
            action
          ),
        }
      : {
          ...charts,
          [action.key]: actionHandlers[action.type](charts[action.key], action),
        };
  }
  return charts;
}
