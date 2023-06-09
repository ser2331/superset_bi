/* eslint camelcase: 0 */
import { getControlsState, getFormDataFromControls } from '../stores/store';
import * as actions from '../actions/exploreActions';

export default function exploreReducer(state = {}, action) {
  const actionHandlers = {
    [actions.TOGGLE_FAVE_STAR]() {
      return Object.assign({}, state, { isStarred: action.isStarred });
    },
    [actions.FETCH_DATASOURCE_STARTED]() {
      return Object.assign({}, state, { isDatasourceMetaLoading: true });
    },
    [actions.FETCH_DATASOURCE_SUCCEEDED]() {
      return Object.assign({}, state, { isDatasourceMetaLoading: false });
    },
    [actions.FETCH_DATASOURCE_FAILED]() {
      // todo(alanna) handle failure/error state
      return Object.assign({}, state,
        {
          isDatasourceMetaLoading: false,
          controlPanelAlert: action.error,
        });
    },
    [actions.SET_DATASOURCE]() {
      return Object.assign({}, state, { datasource: action.datasource });
    },
    [actions.FETCH_DATASOURCES_STARTED]() {
      return Object.assign({}, state, { isDatasourcesLoading: true });
    },
    [actions.FETCH_DATASOURCES_SUCCEEDED]() {
      return Object.assign({}, state, { isDatasourcesLoading: false });
    },
    [actions.FETCH_DATASOURCES_FAILED]() {
      // todo(alanna) handle failure/error state
      return Object.assign({}, state,
        {
          isDatasourcesLoading: false,
          controlPanelAlert: action.error,
        });
    },
    [actions.SET_DATASOURCES]() {
      return Object.assign({}, state, { datasources: action.datasources });
    },
    [actions.REMOVE_CONTROL_PANEL_ALERT]() {
      return Object.assign({}, state, { controlPanelAlert: null });
    },
    [actions.SET_FIELD_VALUE]() {
      const controls = Object.assign({}, state.controls);
      const control = Object.assign({}, controls[action.controlName]);
      control.value = action.value;
      control.validationErrors = action.validationErrors;
      controls[action.controlName] = control;
      const changes = { controls };
      if (control.renderTrigger) {
        changes.triggerRender = true;
      }
      return Object.assign({}, state, changes);
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      const controls = getControlsState(state, action.formData);
      return Object.assign({}, state, { controls });
    },
    [actions.UPDATE_CHART_TITLE]() {
      const updatedSlice = Object.assign({}, state.slice, { slice_name: action.slice_name });
      return Object.assign({}, state, { slice: updatedSlice });
    },
    [actions.RESET_FIELDS]() {
      const controls = getControlsState(state, getFormDataFromControls(state.controls), { reset: true });
      return Object.assign({}, state, { controls });
    },
    [actions.CREATE_NEW_SLICE]() {
      return Object.assign({}, state, {
        slice: action.slice,
        controls: getControlsState(state, action.form_data),
        can_add: action.can_add,
        can_download: action.can_download,
        can_overwrite: action.can_overwrite,
      });
    },
    [actions.SET_HIERARCHIES]() {
      return Object.assign({}, state, { hierarchies: action.hierarchies });
    },
    [actions.ORDER_BY]() {
      const controls = { ...state.controls };
      const orderDescControl = controls['order_desc'];
      const orderColumnControl = controls['timeseries_limit_metric'];
      orderDescControl.value = (action.orderDirection === 'desc');
      orderColumnControl.value = action.orderColumn;
      controls['order_desc'] = orderDescControl;
      controls['timeseries_limit_metric'] = orderColumnControl;
      return { ...state, controls, triggerRender: true };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
