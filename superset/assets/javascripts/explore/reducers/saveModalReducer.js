/* eslint camelcase: 0 */
import * as actions from '../actions/saveModalActions';
import { t } from '../../locales';

export default function saveModalReducer(state = {}, action) {
  const actionHandlers = {
    [actions.FETCH_DASHBOARDS_SUCCEEDED]() {
      return Object.assign({}, state, { dashboards: action.choices });
    },
    [actions.FETCH_DASHBOARDS_FAILED]() {
      return Object.assign({}, state,
        { saveModalAlert: t(`fetching dashboards failed for %s`, action.userId) });
    },
    [actions.SAVE_SLICE_FAILED]() {
      return Object.assign({}, state, { saveModalAlert: t('Failed to save slice') });
    },
    [actions.SAVE_SLICE_SUCCESS](data) {
      return Object.assign({}, state, { data });
    },
    [actions.REMOVE_SAVE_MODAL_ALERT]() {
      return Object.assign({}, state, { saveModalAlert: null });
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
