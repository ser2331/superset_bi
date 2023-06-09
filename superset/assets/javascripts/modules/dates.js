import { moment } from '../i18n';

const d3 = require('d3');

const config = {
    decimal: '.',
    thousands: ',',
    grouping: [3],
    currency: ['$', ''],
    dateTime: '%a %b %e %X %Y',
    date: '%m/%d/%Y',
    time: '%H:%M:%S',
    periods: ['AM', 'PM'],
    days: moment.weekdays().map(item => item.charAt(0).toUpperCase() + item.substr(1)),
    shortDays: moment.weekdaysShort().map(item => item.charAt(0).toUpperCase() + item.substr(1)),
    months: moment.months().map(item => item.charAt(0).toUpperCase() + item.substr(1)),
    shortMonths: moment.monthsShort().map(item => item.charAt(0).toUpperCase() + item.substr(1)),
};


const d3Formatters = d3.locale(config);

export function UTC(dttm) {
  return new Date(
    dttm.getUTCFullYear(),
    dttm.getUTCMonth(),
    dttm.getUTCDate(),
    dttm.getUTCHours(),
    dttm.getUTCMinutes(),
    dttm.getUTCSeconds(),
  );
}
export const tickMultiFormat = d3Formatters.timeFormat.multi([
  [
    '.%L',
    function (d) {
      return d.getMilliseconds();
    },
  ],
  // If there are millisections, show  only them
  [
    ':%S',
    function (d) {
      return d.getSeconds();
    },
  ],
  // If there are seconds, show only them
  [
    '%a %b %d, %H:%M',
    function (d) {
      return d.getMinutes() !== 0;
    },
  ],
  // If there are non-zero minutes, show Date, Hour:Minute
  [
    '%a %b %d, %H',
    function (d) {
      return d.getHours() !== 0;
    },
  ],
  // If there are hours that are multiples of 3, show date and AM/PM
  [
    '%a %b %e',
    function (d) {
      return d.getDate() >= 10;
    },
  ],
  // If not the first of the month: "Tue Mar 2"
  [
    '%a %b%e',
    function (d) {
      return d.getDate() >= 1;
    },
  ],
  // If >= 10th of the month, compensate for padding : "Sun Mar 15"
  [
    '%Y',
    function () {
      return true;
    },
  ],  // fall back on just year: '2020'
]);
export const formatDate = function (dttm) {
  const d = UTC(new Date(dttm));
  return tickMultiFormat(d);
};

export const makeFormatDateExt = timeGrain => (dttm) => {
  const d = UTC(new Date(dttm));
  switch (timeGrain) {
    case 'P1Y': {
      return d3Formatters.timeFormat('%Y')(d);
    }
    case 'P0.25Y': {
      return d3Formatters.timeFormat('%B, %Y')(d);
    }
    case 'P1M': {
      return d3Formatters.timeFormat('%B, %Y')(d);
    }
    default: {
      return tickMultiFormat(d);
    }
  }
};

export const formatDateThunk = function (format) {
  if (!format) {
    return formatDate;
  }

  const formatter = d3.time.format(format);
  return (dttm) => {
    const d = UTC(new Date(dttm));
    return formatter(d);
  };
};

export const fDuration = function (t1, t2, format = 'HH:mm:ss.SS') {
  const diffSec = t2 - t1;
  const duration = moment(new Date(diffSec));
  return duration.utc().format(format);
};

export const now = function () {
  // seconds from EPOCH as a float
  return moment().utc().valueOf();
};

export const epochTimeXHoursAgo = function (h) {
  return moment()
    .subtract(h, 'hours')
    .utc()
    .valueOf();
};

export const epochTimeXDaysAgo = function (d) {
  return moment()
    .subtract(d, 'days')
    .utc()
    .valueOf();
};

export const epochTimeXYearsAgo = function (y) {
  return moment()
    .subtract(y, 'years')
    .utc()
    .valueOf();
};
