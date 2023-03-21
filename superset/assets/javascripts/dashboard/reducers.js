/* eslint-disable camelcase */
import { combineReducers } from 'redux';
import d3 from 'd3';
import shortid from 'shortid';
import queryString from 'query-string';

import charts, { chart } from '../chart/chartReducer';
import * as actions from './actions';
import { getParam } from '../modules/utils';
import { alterInArr, removeFromArr } from '../reduxUtils';
import { applyDefaultFormData } from '../explore/stores/store';
import { getColorFromScheme } from '../modules/colors';

import * as chartActions from '../chart/chartAction';

export function getInitialState(bootstrapData) {
  const { user_id, datasources, common, editMode } = bootstrapData;
  delete common.locale;
  delete common.language_pack;

  const dashboard = { ...bootstrapData.dashboard_data };
  let filters = {};
  try {
    // allow request parameter overwrite dashboard metadata
    const key = getParam('preselect_filters_key');
    const preselct_filters = key && sessionStorage.getItem(key);
    filters = JSON.parse(
      preselct_filters || dashboard.metadata.default_filters
    );
  } catch (e) {
    //
  }

  // Priming the color palette with user's label-color mapping provided in
  // the dashboard's JSON metadata
  if (dashboard.metadata && dashboard.metadata.label_colors) {
    const colorMap = dashboard.metadata.label_colors;
    for (const label in colorMap) {
      getColorFromScheme(label, null, colorMap[label]);
    }
  }

  dashboard.posDict = {};
  dashboard.layout = [];
  if (Array.isArray(dashboard.position_json)) {
    dashboard.position_json.forEach((position) => {
      dashboard.posDict[position.slice_id] = position;
    });
  } else {
    dashboard.position_json = [];
  }

  const lastRowId = Math.max(
    0,
    Math.max.apply(
      null,
      dashboard.position_json.map((pos) => pos.row + pos.size_y)
    )
  );
  let newSliceCounter = 0;
  dashboard.slices.forEach((slice) => {
    const sliceId = slice.slice_id;
    let pos = dashboard.posDict[sliceId];
    if (!pos) {
      // append new slices to dashboard bottom, 3 slices per row
      pos = {
        col: (newSliceCounter % 3) * 16 + 1,
        row: lastRowId + Math.floor(newSliceCounter / 3) * 16,
        size_x: 16,
        size_y: 16,
      };
      newSliceCounter++;
    }

    dashboard.layout.push({
      i: String(sliceId),
      x: pos.col - 1,
      y: pos.row,
      w: pos.size_x,
      minW: 2,
      h: pos.size_y,
    });
  });

  // will use charts action/reducers to handle chart render
  const initCharts = {};

  const url = queryString.parse(location.search);
  const history = JSON.parse(sessionStorage.getItem(url.hid)) || [];
  // Стейт по-умолчанию
  if (!url.hid || !url.hid_index || !history.length) {
    dashboard.slices.forEach((slice) => {
      const chartKey = 'slice_' + slice.slice_id;
      initCharts[chartKey] = {
        ...chart,
        chartKey,
        slice_id: slice.slice_id,
        form_data: slice.form_data,
        formData: applyDefaultFormData(slice.form_data),
      };
    });
    // also need to add formData for dashboard.slices
    dashboard.slices = dashboard.slices.map((slice) => ({
      ...slice,
      formData: applyDefaultFormData(slice.form_data),
    }));
  } else {
    // В урле есть метка о дриллдауне на дашборд
    const existingDashboardState = history[url.hid_index];
    const previousDashboardState = history[url.hid_index - 1];
    const lastDashboardState = history[history.length - 1];
    const dashboardState = existingDashboardState || lastDashboardState;

    dashboard.slices = dashboard.slices.map((slice) => {
      const matchingSlice = dashboardState.slices.find(
        (item) => item.slice_id === slice.slice_id
      );
      return matchingSlice
        ? {
            ...slice,
            formData: matchingSlice.formData,
            prevFormData: matchingSlice.prevFormData,
          }
        : {
            ...slice,
            formData: applyDefaultFormData(slice.form_data),
            prevFormData: slice.prevFormData,
          };
    });
    dashboard.slices.forEach((slice) => {
      const chartKey = `slice_${slice.slice_id}`;
      initCharts[chartKey] = {
        ...chart,
        chartKey,
        slice_id: slice.slice_id,
        form_data: slice.form_data,
        formData: applyDefaultFormData(slice.form_data),
        prevFormData: slice.prevFormData,
      };
    });
    dashboard.prevState = previousDashboardState;
    filters = { ...(dashboardState.filters || {}), ...filters };
    if (existingDashboardState) {
      sessionStorage.setItem(
        url.hid,
        JSON.stringify(history.slice(0, url.hid_index + 1))
      );
    }
  }

  return {
    charts: initCharts,
    dashboard: {
      filters,
      dashboard,
      userId: user_id,
      datasources,
      common,
      editMode,
    },
  };
}

export const dashboard = function (state = {}, action) {
  const actionHandlers = {
    [actions.UPDATE_DASHBOARD_TITLE]() {
      const newDashboard = {
        ...state.dashboard,
        dashboard_title: action.title,
      };
      return { ...state, dashboard: newDashboard };
    },
    [actions.UPDATE_DASHBOARD_LAYOUT]() {
      const newDashboard = { ...state.dashboard, layout: action.layout };
      return { ...state, dashboard: newDashboard };
    },
    [actions.REMOVE_SLICE]() {
      const key = String(action.slice.slice_id);
      const newLayout = state.dashboard.layout.filter(
        (reactPos) => reactPos.i !== key
      );
      const newDashboard = removeFromArr(
        state.dashboard,
        'slices',
        action.slice,
        'slice_id'
      );
      // if this slice is a filter
      const newFilter = { ...state.filters };
      let refresh = false;
      if (state.filters[key]) {
        delete newFilter[key];
        refresh = true;
      }
      return {
        ...state,
        dashboard: { ...newDashboard, layout: newLayout },
        filters: newFilter,
        refresh,
      };
    },
    [actions.TOGGLE_FAVE_STAR]() {
      return { ...state, isStarred: action.isStarred };
    },
    [actions.SET_EDIT_MODE]() {
      return { ...state, editMode: action.editMode };
    },
    [actions.TOGGLE_EXPAND_SLICE]() {
      const updatedExpandedSlices = {
        ...state.dashboard.metadata.expanded_slices,
      };
      const sliceId = action.slice.slice_id;
      if (action.isExpanded) {
        updatedExpandedSlices[sliceId] = true;
      } else {
        delete updatedExpandedSlices[sliceId];
      }
      const metadata = {
        ...state.dashboard.metadata,
        expanded_slices: updatedExpandedSlices,
      };
      const newDashboard = { ...state.dashboard, metadata };
      return { ...state, dashboard: newDashboard };
    },

    // filters
    [actions.ADD_FILTER]() {
      const selectedSlice = state.dashboard.slices.find(
        (slice) => slice.slice_id === action.sliceId
      );
      if (!selectedSlice) {
        return state;
      }

      let filters = state.filters;
      const { sliceId, col, vals, merge, refresh } = action;
      const filterKeys = [
        '__from',
        '__to',
        '__time_col',
        '__time_grain',
        '__time_origin',
        '__granularity',
      ];
      if (
        filterKeys.indexOf(col) >= 0 ||
        selectedSlice.formData.groupby.indexOf(col) !== -1
      ) {
        const newFilter = { col, op: 'in', val: vals, source: 'filter_box' };

        let newSliceFilters;
        if (!vals.length) {
          newSliceFilters = (filters[sliceId] || []).filter(
            (filter) => filter.col !== col && filter.source === 'filter_box'
          );
        } else {
          const existingFilter = (filters[sliceId] || []).find(
            (f) => f.col === col
          );
          if (existingFilter) {
            newSliceFilters = filters[sliceId].map((filter) =>
              filter.col === col ? { ...filter, val: vals } : filter
            );
          } else {
            newSliceFilters = [...(filters[sliceId] || []), newFilter];
          }
        }
        filters = { ...filters, [sliceId]: newSliceFilters };
      }
      return { ...state, filters, refresh };
    },
    [actions.CLEAR_FILTER]() {
      const newFilters = { ...state.filters };
      delete newFilters[action.sliceId];
      return { ...state, filter: newFilters, refresh: true };
    },
    [actions.REMOVE_FILTER]() {
      const { sliceId, col, vals, refresh } = action;
      const excluded = new Set(vals);
      const valFilter = (val) => !excluded.has(val);

      let filters = state.filters;
      // Have to be careful not to modify the dashboard state so that
      // the render actually triggers
      if (sliceId in state.filters && col in state.filters[sliceId]) {
        const newFilter = filters[sliceId][col].filter(valFilter);
        filters = { ...filters, [sliceId]: newFilter };
      }
      return { ...state, filters, refresh };
    },

    // slice reducer
    [actions.UPDATE_SLICE_NAME]() {
      const newDashboard = alterInArr(
        state.dashboard,
        'slices',
        action.slice,
        { slice_name: action.sliceName },
        'slice_id'
      );
      return { ...state, dashboard: newDashboard };
    },

    [chartActions.SAVE_DASHBOARD_STATE]() {
      const hid = action.hid;
      const hid_index = action.hid_index;
      const history = JSON.parse(sessionStorage.getItem(hid)) || [];
      const dashboardState = {
        type: 'dashboard',
        id: state.dashboard.id,
        slices: state.dashboard.slices,
        filters: state.filters,
        hid,
        hid_index,
      };
      history.push(dashboardState);
      sessionStorage.setItem(hid, JSON.stringify(history));
      return {
        ...state,
      };
    },
    // TODO: Логика этих экшнов дублирует логику в chartReducer, т.к. стейт charts
    // тут недоступен, чтобы обновить на его основе слайсы в dashboard.
    // Видимо надо либо кастомизировать combineReducers, раз уж charts по сути дочерний
    // к dashboard, либо прокидывать изменения в payload экшна.
    [chartActions.SAVE_SLICE_STATE]() {
      const slice = state.dashboard.slices.find(
        (item) => item.slice_id === action.sliceId
      );
      const prevFormData = {
        formData: slice.formData,
        slice_name: slice.slice_name,
        filters: [...slice.formData.filters],
        groupby: [...slice.formData.groupby],
        columns: [...(slice.formData.columns || [])],
      };
      const newSlices = state.dashboard.slices.map((item) =>
        item === slice
          ? {
              ...item,
              prevFormData: [prevFormData, ...(item.prevFormData || [])],
            }
          : item
      );
      return { ...state, dashboard: { ...state.dashboard, slices: newSlices } };
    },
    [chartActions.REVERT_SLICE_STATE]() {
      const slice = state.dashboard.slices.find(
        (item) => item.slice_id === action.sliceId
      );
      const [lastState, ...prevFormData] = slice.prevFormData;
      const newSlices = state.dashboard.slices.map((item) =>
        item === slice
          ? {
              ...item,
              slice_name: lastState.slice_name,
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
          : item
      );
      return { ...state, dashboard: { ...state.dashboard, slices: newSlices } };
    },
    [chartActions.DRILLDOWN_TO_SLICE]() {
      const slice = state.dashboard.slices.find(
        (item) => `slice_${item.slice_id}` === action.key
      );
      const newSlices = state.dashboard.slices.map((item) =>
        item === slice
          ? {
              ...slice,
              slice_name: action.formData.slice_name || slice.slice_name,
              formData: action.formData,
              form_data: action.formData,
            }
          : item
      );
      if (action.datasources) {
        const datasourceName = Object.keys(action.datasources)[0];
        const newDatasources = {
          ...state.datasources,
          [datasourceName]: action.datasources[datasourceName],
        };
        return {
          ...state,
          dashboard: { ...state.dashboard, slices: newSlices },
          datasources: newDatasources,
        };
      }
      return {
        ...state,
        dashboard: { ...state.dashboard, slices: newSlices },
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};

export default combineReducers({
  charts,
  dashboard,
  impressionId: () => shortid.generate(),
});
