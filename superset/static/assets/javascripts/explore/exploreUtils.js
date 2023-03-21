/* eslint camelcase: 0 */
import URI from 'urijs';
import { v4 as uuidv4 } from 'uuid';

export function getChartKey(explore) {
  const slice = explore.slice;
  return slice ? 'slice_' + slice.slice_id : 'slice';
}

export function convertNullValues(val) {
  //функция для преобразования null-значения в строку 'null', так как селект боксы видят null , как пустое значение
  if (val === 'null') return null;
  if (val === null) return 'null';
  return val;
}

export function getAnnotationJsonUrl(slice_id, form_data, isNative) {
  if (slice_id === null || slice_id === undefined) {
    return null;
  }
  const uri = URI(window.location.search);
  const endpoint = isNative ? 'annotation_json' : 'slice_json';
  return uri
    .pathname(`/superset/${endpoint}/${slice_id}`)
    .search({
      form_data: JSON.stringify(form_data, (key, value) =>
        value === null ? undefined : value
      ),
    })
    .toString();
}

export function getURIDirectory(formData, endpointType = 'base') {
  // Building the directory part of the URI
  let directory = '/superset/explore/';
  if (['json', 'csv', 'excel', 'query'].indexOf(endpointType) >= 0) {
    directory = '/superset/explore_json/';
  }
  return directory;
}

export function getExploreLongUrl(formData, endpointType) {
  if (!formData.datasource) {
    return null;
  }

  const uri = new URI('/');
  const directory = getURIDirectory(formData, endpointType);
  const search = uri.search(true);
  search.form_data = JSON.stringify(formData);
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  return uri
    .directory(directory)
    .search(search)
    .toString();
}

export function getExploreUrlAndPayload({
  formData,
  endpointType = 'base',
  force = false,
  curUrl = null,
  requestParams = {},
  isStopAsync,
}) {
  if (!formData.datasource) {
    return null;
  }

  // The search params from the window.location are carried through,
  // but can be specified with curUrl (used for unit tests to spoof
  // the window.location).
  let uri = new URI([location.protocol, '//', location.host].join(''));
  if (curUrl) {
    uri = URI(URI(curUrl).search());
  }

  const directory = getURIDirectory(formData, endpointType);

  // Building the querystring (search) part of the URI
  const search = uri.search(true);
  if (formData.slice_id) {
    search.form_data = JSON.stringify({
      slice_id: formData.slice_id,
      fields_by_slice: true,
    });
  }
  if ((formData?.allow_run_async || false) && !isStopAsync && !force) {
    search.query_identity = uuidv4();
    search.async = true;
  }

  if (force) {
    search.force = 'true';
  }
  if (endpointType === 'csv') {
    search.csv = 'true';
  }
  if (endpointType === 'excel') {
    search.excel = 'true';
  }
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  if (endpointType === 'query') {
    search.query = 'true';
  }
  const paramNames = Object.keys(requestParams);
  if (paramNames.length) {
    paramNames.forEach((name) => {
      if (requestParams.hasOwnProperty(name)) {
        search[name] = requestParams[name];
      }
    });
  }
  uri = uri.search(search).directory(directory);
  const payload = { ...formData };

  return {
    url: uri.toString(),
    payload,
    id: search.query_identity,
  };
}

export function exportChart(formData, endpointType) {
  const isStopAsync = true;
  let { url, payload } = getExploreUrlAndPayload({
    formData,
    endpointType,
    isStopAsync,
  });

  // TODO : Пересмотреть для чего эта фильтрация по фильтрам
  // payload = {
  //   ...payload,
  //   extra_filters: (payload.extra_filters || []).filter((f) => !f.isPeriod),
  // };

  const exploreForm = document.createElement('form');
  exploreForm.action = url;
  exploreForm.method = 'POST';
  exploreForm.target = '_blank';
  const token = document.createElement('input');
  token.type = 'hidden';
  token.name = 'csrf_token';
  token.value = (document.getElementById('csrf_token') || {}).value;
  exploreForm.appendChild(token);
  const data = document.createElement('input');
  data.type = 'hidden';
  data.name = 'form_data';
  data.value = JSON.stringify(payload);
  exploreForm.appendChild(data);
  document.body.appendChild(exploreForm);
  exploreForm.submit();
  document.body.removeChild(exploreForm);
}

export function applyEffectiveExtraFilters(formData, dashboard) {
  const { metadata } = dashboard.dashboard;
  const { slice_id: sliceId } = formData;
  const filters = formData.viz_type === 'filter_box' ? {} : dashboard.filters;
  const immuneSlices = metadata.filter_immune_slices || [];
  if (
    (sliceId && immuneSlices.includes(sliceId)) ||
    !Object.keys(filters).length
  ) {
    // The slice is immune to dashboard filters
    return { ...formData };
  }
  return {
    ...formData,
    extra_filters: [
      ...Object.keys(filters).reduce((accum, key) => {
        if (filters[key].length) {
          return [...accum, ...filters[key].slice()];
        }
        return [...accum];
      }, []),
    ],
  };
}
