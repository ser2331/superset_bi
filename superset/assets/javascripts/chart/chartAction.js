import {
  getExploreUrlAndPayload,
  getAnnotationJsonUrl,
} from '../explore/exploreUtils';
import {
  requiresQuery,
  ANNOTATION_SOURCE_TYPES,
} from '../modules/AnnotationTypes';
import { Logger, LOG_ACTIONS_LOAD_EVENT } from '../logger';
import { changeSlice } from '../dashboard/actions';

const $ = (window.$ = require('jquery'));

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryRequest, latestQueryFormData, key) {
  return { type: CHART_UPDATE_STARTED, queryRequest, latestQueryFormData, key };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queryResponse, key) {
  return { type: CHART_UPDATE_SUCCEEDED, queryResponse, key };
}

export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED';
export function chartUpdateStopped(key) {
  return { type: CHART_UPDATE_STOPPED, key };
}

export const CHART_UPDATE_TIMEOUT = 'CHART_UPDATE_TIMEOUT';
export function chartUpdateTimeout(statusText, timeout, key) {
  return { type: CHART_UPDATE_TIMEOUT, statusText, timeout, key };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED';
export function chartUpdateFailed(queryResponse, key) {
  return { type: CHART_UPDATE_FAILED, queryResponse, key };
}

export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED';
export function chartRenderingFailed(error, key) {
  return { type: CHART_RENDERING_FAILED, error, key };
}

export const CHART_RENDERING_SUCCEEDED = 'CHART_RENDERING_SUCCEEDED';
export function chartRenderingSucceeded(key) {
  return { type: CHART_RENDERING_SUCCEEDED, key };
}

export const REMOVE_CHART = 'REMOVE_CHART';
export function removeChart(key) {
  return { type: REMOVE_CHART, key };
}

export const ANNOTATION_QUERY_SUCCESS = 'ANNOTATION_QUERY_SUCCESS';
export function annotationQuerySuccess(annotation, queryResponse, key) {
  return { type: ANNOTATION_QUERY_SUCCESS, annotation, queryResponse, key };
}

export const ANNOTATION_QUERY_STARTED = 'ANNOTATION_QUERY_STARTED';
export function annotationQueryStarted(annotation, queryRequest, key) {
  return { type: ANNOTATION_QUERY_STARTED, annotation, queryRequest, key };
}

export const ANNOTATION_QUERY_FAILED = 'ANNOTATION_QUERY_FAILED';
export function annotationQueryFailed(annotation, queryResponse, key) {
  return { type: ANNOTATION_QUERY_FAILED, annotation, queryResponse, key };
}

export function runAnnotationQuery(
  annotation,
  timeout = 60,
  formData = null,
  key
) {
  return function (dispatch, getState) {
    const sliceKey = key || Object.keys(getState().charts)[0];
    const fd = formData || getState().charts[sliceKey].latestQueryFormData;

    if (!requiresQuery(annotation.sourceType)) {
      return Promise.resolve();
    }

    const sliceFormData = Object.keys(annotation.overrides).reduce(
      (d, k) => ({
        ...d,
        [k]: annotation.overrides[k] || fd[k],
      }),
      {}
    );
    const isNative = annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE;
    const url = getAnnotationJsonUrl(annotation.value, sliceFormData, isNative);
    const queryRequest = $.ajax({
      url,
      dataType: 'json',
      timeout: timeout * 1000,
    });
    dispatch(annotationQueryStarted(annotation, queryRequest, sliceKey));
    return queryRequest
      .then((queryResponse) =>
        dispatch(annotationQuerySuccess(annotation, queryResponse, sliceKey))
      )
      .catch((err) => {
        if (err.statusText === 'timeout') {
          dispatch(
            annotationQueryFailed(
              annotation,
              { error: 'Query Timeout' },
              sliceKey
            )
          );
        } else if (
          (err.responseJSON.error || '').toLowerCase().startsWith('no data')
        ) {
          dispatch(annotationQuerySuccess(annotation, err, sliceKey));
        } else if (err.statusText !== 'abort') {
          dispatch(
            annotationQueryFailed(annotation, err.responseJSON, sliceKey)
          );
        }
      });
  };
}

export const TRIGGER_QUERY = 'TRIGGER_QUERY';
export function triggerQuery(value = true, key) {
  return { type: TRIGGER_QUERY, value, key };
}

// this action is used for forced re-render without fetch data
export const RENDER_TRIGGERED = 'RENDER_TRIGGERED';
export function renderTriggered(value, key) {
  return { type: RENDER_TRIGGERED, value, key };
}

export const UPDATE_QUERY_FORM_DATA = 'UPDATE_QUERY_FORM_DATA';
export function updateQueryFormData(value, key) {
  return { type: UPDATE_QUERY_FORM_DATA, value, key };
}

export const RUN_QUERY = 'RUN_QUERY';
export function runQuery(formData, force = false, timeout = 60, key) {
  return (dispatch) => {
    const { url, payload } = getExploreUrlAndPayload({
      formData,
      endpointType: 'json',
      force,
    });
    const logStart = Logger.getTimestamp();
    const queryRequest = $.ajax({
      type: 'POST',
      url,
      dataType: 'json',
      data: {
        form_data: JSON.stringify(payload),
      },
      timeout: timeout * 1000,
    });
    const queryPromise = Promise.resolve(
      dispatch(chartUpdateStarted(queryRequest, payload, key))
    )
      .then(() => queryRequest)
      .then((queryResponse) => {
        Logger.append(LOG_ACTIONS_LOAD_EVENT, {
          label: key,
          is_cached: queryResponse.is_cached,
          row_count: queryResponse.rowcount,
          datasource: formData.datasource,
          start_offset: logStart,
          duration: Logger.getTimestamp() - logStart,
        });
        return dispatch(chartUpdateSucceeded(queryResponse, key));
      })
      .catch((err) => {
        Logger.append(LOG_ACTIONS_LOAD_EVENT, {
          label: key,
          has_err: true,
          datasource: formData.datasource,
          start_offset: logStart,
          duration: Logger.getTimestamp() - logStart,
        });
        if (err.statusText === 'timeout') {
          dispatch(chartUpdateTimeout(err.statusText, timeout, key));
        } else if (err.statusText === 'abort') {
          dispatch(chartUpdateStopped(key));
        } else {
          let errObject;
          if (err.responseJSON) {
            errObject = err.responseJSON;
          } else if (err.stack) {
            errObject = {
              error: 'Unexpected error: ' + err.description,
              stacktrace: err.stack,
            };
          } else {
            errObject = {
              error: 'Unexpected error.',
            };
          }
          dispatch(chartUpdateFailed(errObject, key));
        }
      });
    const annotationLayers = formData.annotation_layers || [];
    return Promise.all([
      queryPromise,
      dispatch(triggerQuery(false, key)),
      dispatch(updateQueryFormData(payload, key)),
      ...annotationLayers.map((x) =>
        dispatch(runAnnotationQuery(x, timeout, formData, key))
      ),
    ]);
  };
}

/* CUSTOMIZATION */
export const SAVE_DASHBOARD_STATE = 'SAVE_DASHBOARD_STATE';
export function saveDashboardState(hid, hid_index) {
  return { type: SAVE_DASHBOARD_STATE, hid, hid_index };
}

export const SAVE_SLICE_STATE = 'SAVE_SLICE_STATE';
export function saveSliceState(sliceId) {
  // TODO: key = slice.props.chartKey, редьюсер chart совершенно
  // по-уродски завязан на chartKey заполняемый в GridLayout.jsx
  return { type: SAVE_SLICE_STATE, sliceId, key: `slice_${sliceId}` };
}

export const REVERT_SLICE_STATE = 'REVERT_SLICE_STATE';
export function revertSliceState(sliceId) {
  return function (dispatch, getState) {
    const chartKey = `slice_${sliceId}`;
    dispatch({ type: REVERT_SLICE_STATE, sliceId, key: chartKey });
    const newFormData = getState().charts[chartKey].formData;
    dispatch(runQuery(newFormData, false, 60, chartKey));
  };
}

export const DRILLDOWN_TO_SLICE = 'DRILLDOWN_TO_SLICE';
export function drilldownToSlice(chartKey, sliceId, formData, datasources) {
  return function (dispatch, getState) {
    dispatch({
      type: DRILLDOWN_TO_SLICE,
      key: chartKey,
      formData,
      datasources,
    });
    dispatch(runQuery(formData, true, 60, chartKey));
  };
}
