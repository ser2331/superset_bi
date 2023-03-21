import { t } from "../locales";

export const AGGREGATES = {
  AVG: 'AVG',
  COUNT: 'COUNT',
  COUNT_DISTINCT: 'COUNT_DISTINCT',
  MAX: 'MAX',
  MIN: 'MIN',
  SUM: 'SUM',
};
export const AGGREGATES_TRANSLATED = {
  AVG: t('AVG'),
  COUNT: t('COUNT'),
  COUNT_DISTINCT: t('COUNT_DISTINCT'),
  MAX: t('MAX'),
  MIN: t('MIN'),
  SUM: t('SUM'),
};

export const AGGREGATES_SUB_TOTALS = {
  MEAN: t('AVG'),
  MAX: t('MAX'),
  MIN: t('MIN'),
  SUM: t('SUM'),
};

export const BASE_AGGREGATES = {
  MEAN: 'MEAN',
  MAX: 'MAX',
  MIN: 'MIN',
  SUM: 'SUM',
};

export const ORDER_SORTING = {
  ASC: 'ASC',
  DESC: 'DESC',
};

export const DEFAULT_ORDER_SORT = ORDER_SORTING.ASC;
