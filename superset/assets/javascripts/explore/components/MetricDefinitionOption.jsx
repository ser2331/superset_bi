import React from 'react';
import PropTypes from 'prop-types';

import MetricOption from '../../components/MetricOption';
import ColumnOption from '../../components/ColumnOption';
import AggregateOption from './AggregateOption';
import columnType from '../propTypes/columnType';
import savedMetricType from '../propTypes/savedMetricType';
import aggregateOptionType from '../propTypes/aggregateOptionType';
import { t } from '../../locales';

const propTypes = {
  option: PropTypes.oneOfType([
    columnType,
    savedMetricType,
    aggregateOptionType,
  ]).isRequired,
};

export default function MetricDefinitionOption({ option }) {
  if (option.metric_name) {
    return (
      <MetricOption metric={option} showType />
    );
  } else if (option.column_name) {
    return (
      <ColumnOption column={option} showType />
    );
  } else if (option.aggregate_name) {
    return (
      <AggregateOption aggregate={option} showType />
    );
  }
  notify.error(t('You must supply either a saved metric, column or aggregate to MetricDefinitionOption'));
  return null;
}
MetricDefinitionOption.propTypes = propTypes;
