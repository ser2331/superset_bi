import API_CONFIG from './config';

const api = (url, data, method = 'GET') => {
  const request =  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'X-CSRFToken': $('[name=csrf_token]').val(),
    },
    body: data ? JSON.stringify(data) : null,
  });
  return request.then(response => response.json()).catch(() => null);
};

export function getSlices() {
    return api(API_CONFIG.getSlices);
}

export function getSlicesFolders() {
    return api(API_CONFIG.getSliceFolder);
}

export function getDataSourcesSliceFolder() {
    return api(API_CONFIG.getDataSourcesSliceFolder);
}

export function createSlicesFolders(data) {
    return api(API_CONFIG.postSliceFolder, data, 'post');
}

export function editSlicefolder({ id, ...rest }) {
    return api(API_CONFIG.editSlicefolder(id), rest, 'PUT');
}

export function deleteSlicefolder(id) {
    return api(API_CONFIG.deleteSlicefolder(id), null, 'DELETE');
}

export function moveSlice({ id, ...rest }) {
    return api(API_CONFIG.moveSlice(id), rest, 'PUT');
}

export function getDashboards() {
    return api(API_CONFIG.getDashboards);
}
