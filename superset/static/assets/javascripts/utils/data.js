import { sqlDateFormats, dateTypes } from '../../constants/common';
import moment from 'moment';

export function convertDataForSql(value, columnOption) {
  const { type } = columnOption;
  switch (type) {
    case dateTypes.DATE:
    case dateTypes.NULLABLEDATE:
    case dateTypes.DATETIME:
    case dateTypes.NULLABLEDATETIME:
      return moment(value).format(sqlDateFormats[type]);
    case dateTypes.VARCHAR:
      return value.toString();
    default:
      return value;
  }
}

export const createToLowerCase = (str) => {
  if (str) {
    return str.toLowerCase();
  } else {
    return '';
  }
};
