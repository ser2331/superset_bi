/* global notify */
/* eslint global-require: 0 */
import $ from 'jquery';
import { t, tn } from '../locales';
import {AGGREGATES_TRANSLATED} from "../../javascripts/explore/constants"

const d3 = window.d3 || require('d3');

export const EARTH_CIRCUMFERENCE_KM = 40075.16;
export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;
export const MILES_PER_KM = 1.60934;
export const DEFAULT_LONGITUDE = -122.405293;
export const DEFAULT_LATITUDE = 37.772123;
export const DEFAULT_ZOOM = 11;

export function getWheres(arr = []) {
  return arr
    .map((w) => w.trim())
    .filter((w, i, arr) => w && arr.indexOf(w) === i)
    .join(' and ');
}

export function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel =
    (EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad)) /
    Math.pow(2, zoomLevel + 9);
  return d3.round(kilometers / kmPerPixel, 2);
}

export function isNumeric(num) {
  return !isNaN(parseFloat(num)) && isFinite(num);
}

export function rgbLuminance(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return (
    LUMINANCE_RED_WEIGHT * r +
    LUMINANCE_GREEN_WEIGHT * g +
    LUMINANCE_BLUE_WEIGHT * b
  );
}

export function getParamFromQuery(query, param) {
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i += 1) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === param) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

export function storeQuery(query, callback) {
  $.ajax({
    type: 'POST',
    url: '/kv/store/',
    async: false,
    data: {
      data: JSON.stringify(query),
    },
    success: (data) => {
      const baseUrl = window.location.origin + window.location.pathname;
      const url = `${baseUrl}?id=${JSON.parse(data).id}`;
      callback(url);
    },
  });
}

export function getParamsFromUrl() {
  const hash = window.location.search;
  const params = hash.split('?')[1].split('&');
  const newParams = {};
  params.forEach((p) => {
    const value = p.split('=')[1].replace(/\+/g, ' ');
    const key = p.split('=')[0];
    newParams[key] = value;
  });
  return newParams;
}

export function getShortUrl(longUrl, callback) {
  $.ajax({
    type: 'POST',
    url: '/r/shortner/',
    async: false,
    data: {
      data: '/' + longUrl,
    },
    success: (data) => {
      callback(data);
    },
    error: () => {
      notify.error('Error getting the short URL');
      callback(longUrl);
    },
  });
}

export function supersetURL(rootUrl, getParams = {}) {
  const url = new URL(rootUrl, window.location.origin);
  for (const k in getParams) {
    url.searchParams.set(k, getParams[k]);
  }
  return url.href;
}

export function isTruthy(obj) {
  if (typeof obj === 'boolean') {
    return obj;
  } else if (typeof obj === 'string') {
    return ['yes', 'y', 'true', 't', '1'].indexOf(obj.toLowerCase()) >= 0;
  }
  return !!obj;
}

const RELATIVE_TIME_OPTIONS = ['ago', 'from now'];

export function dehumanizeDate(value) {
  if (value === 'now') return t(value);
  const words = (String(value) || ' ').split(' ');
  const containsAgo = RELATIVE_TIME_OPTIONS.includes(words[2]);
  const containsFromNow = RELATIVE_TIME_OPTIONS.includes(
    `${words[2]} ${words[3]}`
  );

  if (words.length >= 3 && (containsAgo || containsFromNow)) {
    const number = Number.parseInt(words[0], 10);
    const grainSingleForm = words[1].endsWith('s')
      ? words[1].substring(0, words[1].length - 1)
      : words[1];
    const grain = tn(grainSingleForm, words[1], number || 1);
    const rel = containsFromNow ? t(`${words[2]} ${words[3]}`) : t(words[2]);
    return `${number || ''} ${grain} ${rel}`;
  }
  return value;
}

export const checkerNumber = (value) =>
  !(
    typeof value === 'undefined' ||
    value === null ||
    value === '' ||
    isNaN(value)
  );

// удаление не печатных симовлов и пробелов в строке
export function convertToFileName(str = '') {
  return str
    .trim()
    .replace(/[\s\n]/gm, '_')
    .replace(/[^0-9a-zA-Zа-яА-Я\\.\\_]+/gm, '')
    .replace(/_{2,}/, '_');
}

export const downloadBlobFile = (data, filename = 'file', type = 'json') => {
  const file = new Blob([data], { type });

  if (window.navigator.msSaveOrOpenBlob) {
    // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  } else {
    const a = document.createElement('a'),
      url = URL.createObjectURL(file);

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
};

export const resolveItmesData = (items = [], requestFn, delay = 500) => {
  let _items = [...items];
  let result = {};

  let _onResponse = () => undefined;
  let _onError = () => undefined;

  const call = (fn, ...args) => typeof fn === 'function' && fn(...args);

  const fn = (reqData) =>
    requestFn(reqData)
      .then((data) => {
        result = {
          ...result,
          ...data,
        };

        const loadedItems = Object.keys(result);
        _items = _items.filter((item) => !loadedItems.includes(item));

        const isDone = loadedItems.length === items.length;

        call(_onResponse, result);

        if (isDone) {
          return;
        } else {
          setTimeout(() => fn(_items), delay);
        }
      })
      .catch((error) => {
        if (error.status === 410) {
          if (_items.length && localStorage.getItem('idForceUpdateItem')) {
            const itemInLocalStorage = _items.find(
              (el) =>
                el === JSON.parse(localStorage.getItem('idForceUpdateItem'))
            );

            _items = _items.filter((el) => el !== itemInLocalStorage);
            localStorage.removeItem('idForceUpdateItem');
          }
          if (!_items.length) return;
          setTimeout(() => fn(_items), delay);
        } else {
          call(_onError, error);
        }
      });

  fn(_items);

  const returnObj = {
    onResponse: (fn) => {
      _onResponse = fn;
      return returnObj;
    },
    onError: (fn) => {
      _onError = fn;
      return returnObj;
    },
  };

  return returnObj;
};

export const fetchAsyncRunQueries = (
  dataForRender,
  handleAsyncReqStarted,
  setAsyncResponseToRender,
  removeElForAsyncRender
) => {
  const url = '/superset/dashboard/result/';
  const arrId = dataForRender.map((el) => el.id);

  handleAsyncReqStarted();

  resolveItmesData(arrId, (requestData) => {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: 'POST',
        url,
        dataType: 'json',
        data: JSON.stringify(requestData),
        contentType: 'application/json; charset=UTF-8',
        success: resolve,
        error: reject,
      });
    });
  })
    .onResponse((res) => {
      dataForRender.forEach((el) => {
        if (res[el.id]) {
          setAsyncResponseToRender(el.formData, el.payload, res[el.id], el.key);
          removeElForAsyncRender(el.id);
          handleAsyncReqStarted();
        }
      });
    })
    .onError((err) => {
      console.log(err);
    });
};



export const getAggregateTranslateLabel = (label) => {
  if(label === "COUNT(*)") return label

  let res = ""
  let  matchStr = label.split('__')
  let endStr = label.match(/\_{2,}(.*)$/)

  if(matchStr?.length && endStr?.length){
    Object.keys(AGGREGATES_TRANSLATED).forEach((el) => {
      if (matchStr[0] === el) {
        res = res + t(matchStr[0]) + endStr[0]
      }
    });
  }

  return res || label
}