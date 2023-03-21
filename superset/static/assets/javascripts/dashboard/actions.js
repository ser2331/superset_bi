/* global notify */
import $ from 'jquery';
import { getExploreUrlAndPayload } from '../explore/exploreUtils';
import { t } from '../locales';
import { showError } from '../../utils/common';
import { ADD_CHARTS } from '../chart/chartAction';


export const CLOSE_DRILLDOWN_TO_DASHBOARD = 'CLOSE_DRILLDOWN_TO_DASHBOARD';
export function closeDrilldown(selectedItem) {
  return { type: CLOSE_DRILLDOWN_TO_DASHBOARD, selectedItem };
}

export const DRILLDOWN_TO_DASHBOARD = 'DRILLDOWN_TO_DASHBOARD';
export function OpenDrilldown(left, top, drilldown, wheres, selectedItem) {
  return { type: DRILLDOWN_TO_DASHBOARD, drilldown, left, top, wheres, selectedItem };
}

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(sliceId, col, vals, op, merge = true, refresh = true) {
  return { type: ADD_FILTER, sliceId, col, vals, op, merge, refresh };
}

export const CLEAR_FILTER = 'CLEAR_FILTER';
export function clearFilter(sliceId) {
  return { type: CLEAR_FILTER, sliceId };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(sliceId, col, vals, refresh = true) {
  return { type: REMOVE_FILTER, sliceId, col, vals, refresh };
}

export const UPDATE_DASHBOARD_LAYOUT = 'UPDATE_DASHBOARD_LAYOUT';
export function updateDashboardLayout(layout) {
  return { type: UPDATE_DASHBOARD_LAYOUT, layout };
}

export const UPDATE_DASHBOARD_TITLE = 'UPDATE_DASHBOARD_TITLE';
export function updateDashboardTitle(title) {
  return { type: UPDATE_DASHBOARD_TITLE, title };
}

export const ADD_SLICES = 'ADD_SLICES';
export const ADD_SLICES_SUCCESS = 'ADD_SLICES_SUCCESS';
export function addSlicesToDashboard(ids, callBack) {
  return async function(dispatch, getState) {
    dispatch({ type: ADD_SLICES });

    const { dashboard } = getState();
    const { datasources, dashboard: dashBoard } = dashboard || {};
    const { slices } = dashBoard || { slices: [] };

    // фильтруем чтоб существующие заново не добавлялись
    const sliceIds = ids.filter(
      (id) => !slices.find((slice) => slice.slice_id === parseInt(id, 10))
    );

    let slicesData = (
      await Promise.all(
        sliceIds.map(
          (sliceId) =>
            new Promise((resolve) => {
              $.getJSON(`/superset/slice_formdata/${sliceId}/`, (data) => {
                resolve(data);
              }).fail((jqXHR, textStatus, errorThrown) => {
                showError(errorThrown);
                resolve(null);
              });
            })
        )
      )
    ).filter((data) => data !== null);

    // смотрим какие датасоурсе надо подгрузить
    const dataSoursesIds = [];
    slicesData.forEach((sliceData) => {
      const { form_data: formData } = sliceData;
      const { datasource } = formData || {};
      if (
        !(datasource in datasources) &&
        !(dataSoursesIds.indexOf(datasource) > -1)
      ) {
        dataSoursesIds.push(datasource);
      }
    });

    // загружаем датосоурсес
    const datasourcesData = dataSoursesIds.length
      ? (
          await Promise.all(
            dataSoursesIds.map(
              (idType) =>
                new Promise((resolve) => {
                  const [id, type] = idType.split('__');
                  $.getJSON(
                    `/superset/datasource/${type}/${id}/`,
                    (datasource) => {
                      resolve(datasource);
                    }
                  ).fail((jqXHR, textStatus, errorThrown) => {
                    // если не загрузили датасоурсе то удаляем из slicesData соответствующий слайс
                    slicesData = slicesData.filter((sliceData) => {
                      const { form_data: formData } = sliceData;
                      const { datasource } = formData || {};
                      return datasource !== idType;
                    });

                    showError(errorThrown);
                    resolve(null);
                  });
                })
            )
          )
        ).filter((data) => data !== null)
      : [];

    callBack();
    dispatch({ type: ADD_CHARTS, slices: slicesData });
    dispatch({
      type: ADD_SLICES_SUCCESS,
      datasources: datasourcesData,
      slices: slicesData,
    });
  };
}

export const REMOVE_SLICE = 'REMOVE_SLICE';
export function removeSlice(slice) {
  return { type: REMOVE_SLICE, slice };
}

export const UPDATE_SLICE_NAME = 'UPDATE_SLICE_NAME';
export function updateSliceName(slice, sliceName) {
  return { type: UPDATE_SLICE_NAME, slice, sliceName };
}
export function saveSlice(slice, sliceName) {
  const oldName = slice.slice_name;
  return (dispatch) => {
    const sliceParams = {};
    sliceParams.slice_id = slice.slice_id;
    sliceParams.action = 'overwrite';
    sliceParams.slice_name = sliceName;

    const { url, payload } = getExploreUrlAndPayload({
      formData: slice.form_data,
      endpointType: 'base',
      force: false,
      curUrl: null,
      requestParams: sliceParams,
    });
    return $.ajax({
      url,
      type: 'POST',
      data: {
        form_data: JSON.stringify(payload),
      },
      success: () => {
        dispatch(updateSliceName(slice, sliceName));
        notify.success(t('This slice name was saved successfully.'));
      },
      error: () => {
        // if server-side reject the overwrite action,
        // revert to old state
        dispatch(updateSliceName(slice, oldName));
        notify.error(t("You don't have the rights to alter this slice"));
      },
    });
  };
}

const FAVESTAR_BASE_URL = '/superset/favstar/Dashboard';
export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(id) {
  return function(dispatch) {
    const url = `${FAVESTAR_BASE_URL}/${id}/count/`;
    return $.get(url).done((data) => {
      if (data.count > 0) {
        dispatch(toggleFaveStar(true));
      }
    });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(id, isStarred) {
  return function(dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    const url = `${FAVESTAR_BASE_URL}/${id}/${urlSuffix}/`;
    $.get(url);
    dispatch(toggleFaveStar(!isStarred));
  };
}

export const TOGGLE_EXPAND_SLICE = 'TOGGLE_EXPAND_SLICE';
export function toggleExpandSlice(slice, isExpanded) {
  return { type: TOGGLE_EXPAND_SLICE, slice, isExpanded };
}

export const SET_EDIT_MODE = 'SET_EDIT_MODE';
export function setEditMode(editMode) {
  return { type: SET_EDIT_MODE, editMode };
}

// Allow Run Async
export const SET_DATA_FOR_ASYNC_RENDER = 'SET_DATA_FOR_ASYNC_RENDER';
export function setDataForAsyncRender(id, formData, payload, key) {
  return { type: SET_DATA_FOR_ASYNC_RENDER, id, formData, payload, key };
}

export const REMOVE_EL_FOR_ASYNC_RENDER = 'REMOVE_EL_FOR_ASYNC_RENDER';
export function removeElForAsyncRender(id) {
  return { type: REMOVE_EL_FOR_ASYNC_RENDER, id };
}

export const START_ASYNC_REQUEST = 'START_ASYNC_REQUEST';
export function startAsyncRequst(id, sliceId) {
  return { type: START_ASYNC_REQUEST, id, sliceId };
}
