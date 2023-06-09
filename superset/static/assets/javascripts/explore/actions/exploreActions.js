import React from 'react';
/* eslint camelcase: 0 */
import { triggerQuery } from '../../chart/chartAction';
import { t } from '../../locales';

const $ = (window.$ = require('jquery'));

const FAVESTAR_BASE_URL = '/superset/favstar/slice';

export const SET_DATASOURCE_TYPE = 'SET_DATASOURCE_TYPE';
export function setDatasourceType(datasourceType) {
  return { type: SET_DATASOURCE_TYPE, datasourceType };
}

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(datasource) {
  return { type: SET_DATASOURCE, datasource };
}

export const SET_DATASOURCES = 'SET_DATASOURCES';
export function setDatasources(datasources) {
  return { type: SET_DATASOURCES, datasources };
}

export const FETCH_DATASOURCE_STARTED = 'FETCH_DATASOURCE_STARTED';
export function fetchDatasourceStarted() {
  return { type: FETCH_DATASOURCE_STARTED };
}

export const FETCH_DATASOURCE_SUCCEEDED = 'FETCH_DATASOURCE_SUCCEEDED';
export function fetchDatasourceSucceeded() {
  return { type: FETCH_DATASOURCE_SUCCEEDED };
}

export const FETCH_DATASOURCE_FAILED = 'FETCH_DATASOURCE_FAILED';
export function fetchDatasourceFailed(error) {
  return { type: FETCH_DATASOURCE_FAILED, error };
}

export const FETCH_DATASOURCES_STARTED = 'FETCH_DATASOURCES_STARTED';
export function fetchDatasourcesStarted() {
  return { type: FETCH_DATASOURCES_STARTED };
}

export const FETCH_DATASOURCES_SUCCEEDED = 'FETCH_DATASOURCES_SUCCEEDED';
export function fetchDatasourcesSucceeded() {
  return { type: FETCH_DATASOURCES_SUCCEEDED };
}

export const FETCH_DATASOURCES_FAILED = 'FETCH_DATASOURCES_FAILED';
export function fetchDatasourcesFailed(error) {
  return { type: FETCH_DATASOURCES_FAILED, error };
}

export const RESET_FIELDS = 'RESET_FIELDS';
export function resetControls() {
  return { type: RESET_FIELDS };
}

export function fetchDatasourceMetadata(
  datasourceKey,
  alsoTriggerQuery = false
) {
  return function(dispatch) {
    dispatch(fetchDatasourceStarted());
    const url = `/superset/fetch_datasource_metadata?datasourceKey=${datasourceKey}`;
    $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        dispatch(setDatasource(data));
        dispatch(fetchDatasourceSucceeded());
        dispatch(resetControls());
        if (alsoTriggerQuery) {
          dispatch(triggerQuery());
        }
      },
      error(error) {
        dispatch(fetchDatasourceFailed(error.responseJSON.error));
      },
    });
  };
}

export const SET_HIERARCHIES = 'SET_HIERARCHIES';
export const fetchHierarchies = (datasourceId) => (dispatch) => {
  const url = '/superset/fetch_hierarchies';
  $.ajax({
    type: 'GET',
    url,
    success: (data) =>
      dispatch({
        type: SET_HIERARCHIES,
        hierarchies: data,
      }),
    error(error) {
      console.log(error);
    },
  });
};

export function fetchDatasources() {
  return function(dispatch) {
    dispatch(fetchDatasourcesStarted());
    const url = '/superset/datasources/';
    $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        dispatch(setDatasources(data));
        dispatch(fetchDatasourcesSucceeded());
      },
      error(error) {
        dispatch(fetchDatasourcesFailed(error.responseJSON.error));
      },
    });
  };
}

export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(sliceId) {
  return function(dispatch) {
    const url = `${FAVESTAR_BASE_URL}/${sliceId}/count/`;
    $.get(url, (data) => {
      if (data.count > 0) {
        dispatch(toggleFaveStar(true));
      }
    });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(sliceId, isStarred) {
  return function(dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    const url = `${FAVESTAR_BASE_URL}/${sliceId}/${urlSuffix}/`;
    $.get(url);
    dispatch(toggleFaveStar(!isStarred));
  };
}

export const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
export function setControlValue(controlName, value, validationErrors) {
  return { type: SET_FIELD_VALUE, controlName, value, validationErrors };
}

export const UPDATE_EXPLORE_ENDPOINTS = 'UPDATE_EXPLORE_ENDPOINTS';
export function updateExploreEndpoints(jsonUrl, csvUrl, standaloneUrl) {
  return { type: UPDATE_EXPLORE_ENDPOINTS, jsonUrl, csvUrl, standaloneUrl };
}

export const SET_EXPLORE_CONTROLS = 'UPDATE_EXPLORE_CONTROLS';
export function setExploreControls(formData) {
  return { type: SET_EXPLORE_CONTROLS, formData };
}

export const REMOVE_CONTROL_PANEL_ALERT = 'REMOVE_CONTROL_PANEL_ALERT';
export function removeControlPanelAlert() {
  return { type: REMOVE_CONTROL_PANEL_ALERT };
}

export const UPDATE_CHART_TITLE = 'UPDATE_CHART_TITLE';
export function updateChartTitle(slice_name) {
  return { type: UPDATE_CHART_TITLE, slice_name };
}

export const CREATE_NEW_SLICE = 'CREATE_NEW_SLICE';
export function createNewSlice(
  can_add,
  can_download,
  can_overwrite,
  slice,
  form_data
) {
  return {
    type: CREATE_NEW_SLICE,
    can_add,
    can_download,
    can_overwrite,
    slice,
    form_data,
  };
}

export const ORDER_BY = 'ORDER_BY';
export function orderBy(orderColumn, orderDirection, sliceId) {
  return function(dispatch) {
    dispatch({ type: ORDER_BY, orderColumn, orderDirection });
    dispatch(triggerQuery(true, `slice_${sliceId}`));
  };
}

export const SET_DRILLDOWN_METRICS = 'SET_DRILLDOWN_METRICS';
export function setDrilldownMetrics(temp_metrics = []) {
  return (dispatch) => {
    dispatch({ type: SET_DRILLDOWN_METRICS, temp_metrics });
  };
}

export const SET_COLUMN_FORMATS = 'SET_COLUMN_FORMATS';
export const setColumnFormats = newColumnFormat => dispatch => dispatch({ type: SET_COLUMN_FORMATS, payload: newColumnFormat })

export const REMOVE_CONTROL_PANEL_SUCCESS_ALERT =
  'REMOVE_CONTROL_PANEL_SUCCESS_ALERT';
export function removeControlPanelSuccessAlert() {
  return { type: REMOVE_CONTROL_PANEL_SUCCESS_ALERT };
}

export const SAVE_AS_DATA_SOURCE_SUCCEEDED = 'SAVE_AS_DATA_SOURCE_SUCCEEDED';
export function saveAsDataSourceSucceeded(message) {
  return { type: SAVE_AS_DATA_SOURCE_SUCCEEDED, message };
}

export function saveAsDatasource({ form_data, table_name }) {
  return function(dispatch) {
    dispatch(fetchDatasourcesStarted());

    const url = '/superset/save_as_datasource/';
    return $.ajax({
      type: 'POST',
      url,
      data: { form_data: JSON.stringify(form_data), table_name },
      dataType: 'json',
      success: (results) => {
        const { datasource_id: datasourceId } = results;
        let message = '';
        if (datasourceId) {
          message = React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: t(
                "New Chart successfully created. Go to <a href='/superset/explore/table/%s'>Chart</a>",
                datasourceId
              ),
            },
          });
        }
        dispatch(saveAsDataSourceSucceeded(message));
      },
      error(error) {
        dispatch(fetchDatasourcesFailed(error.responseJSON.error));
      },
    });
  };
}

// Allow Run Async
export const SET_DATA_FOR_ASYNC_RENDER_EXPLORE =
  'SET_DATA_FOR_ASYNC_RENDER_EXPLORE ';
export function setDataForAsyncRenderExplore(id, formData, payload, key) {
  return {
    type: SET_DATA_FOR_ASYNC_RENDER_EXPLORE,
    id,
    formData,
    payload,
    key,
  };
}

export const REMOVE_EL_FOR_ASYNC_RENDER_EXPLORE =
  'REMOVE_EL_FOR_ASYNC_RENDER_EXPLORE ';
export function removeElForAsyncRenderExplore(id) {
  return { type: REMOVE_EL_FOR_ASYNC_RENDER_EXPLORE, id };
}

export const START_ASYNC_REQUEST_EXPLORE = 'START_ASYNC_REQUEST_EXPLORE ';
export function startAsyncRequstExplore(id) {
  return { type: START_ASYNC_REQUEST_EXPLORE, id };
}
