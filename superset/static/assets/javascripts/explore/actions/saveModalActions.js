import { getExploreUrlAndPayload } from '../exploreUtils';

const $ = (window.$ = require('jquery'));

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export function fetchDashboards(userId) {
  return function(dispatch) {
    const url = '/dashboardmodelviewasync/api/read';
    return $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        const choices = [];
        for (let i = 0; i < data.pks.length; i++) {
          choices.push({
            value: data.pks[i],
            label: data.result[i].dashboard_title,
          });
        }
        dispatch(fetchDashboardsSucceeded(choices));
      },
      error: () => {
        dispatch(fetchDashboardsFailed(userId));
      },
    });
  };
}

export const FETCH_SLICES_FOLDERS_SUCCEEDED = 'FETCH_SLICES_FOLDERS_SUCCEEDED';
export function fetchSlicesFoldersSucceeded(folders) {
  return { type: FETCH_SLICES_FOLDERS_SUCCEEDED, folders };
}

export const FETCH_SLICES_FOLDERS_FAILED = 'FETCH_SLICES_FOLDERS_FAILED';
export function fetchSlicesFoldersFailed() {
  return { type: FETCH_SLICES_FOLDERS_FAILED };
}

export function fetchSlicesFolders() {
  return function(dispatch) {
    const url = '/superset/folders/slice/';
    return $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        const foldersDate = data.filter(item => item.id !== '#-#').sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });
        const folderTree = (folders, parent = null, level = 0) =>
          folders.reduce((tree, currentItem) => {
            if (currentItem.parent_id === parent) {
              const options = folderTree(folders, currentItem.id, level + 1);
              if (options.length) {
                tree.push({
                  value: currentItem.id,
                  label: currentItem.name,
                  level,
                });
                options.forEach((option) => {
                  tree.push(option);
                });
              } else {
                tree.push({
                  value: currentItem.id,
                  label: currentItem.name,
                  level,
                });
              }
            }
            return tree;
          }, []);
        dispatch(fetchSlicesFoldersSucceeded(folderTree(foldersDate)));
      },
      error: () => {
        dispatch(fetchSlicesFoldersFailed());
      },
    });
  };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}
export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
export function saveSliceSuccess(data) {
  return { type: SAVE_SLICE_SUCCESS, data };
}

export const REMOVE_SAVE_MODAL_ALERT = 'REMOVE_SAVE_MODAL_ALERT';
export function removeSaveModalAlert() {
  return { type: REMOVE_SAVE_MODAL_ALERT };
}

export function saveSlice(formData, requestParams) {
  return (dispatch) => {
    const { url, payload } = getExploreUrlAndPayload({
      formData,
      endpointType: 'base',
      force: false,
      curUrl: null,
      requestParams,
    });
    return $.ajax({
      type: 'POST',
      url,
      data: {
        form_data: JSON.stringify(payload),
      },
      success: (data) => {
        dispatch(saveSliceSuccess(data));
      },
      error: () => {
        dispatch(saveSliceFailed());
      },
    });
  };
}
