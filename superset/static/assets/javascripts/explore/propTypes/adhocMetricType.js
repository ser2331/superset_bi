import PropTypes from 'prop-types';

import { AGGREGATES, AGGREGATES_SUB_TOTALS } from '../constants';
import columnType from './columnType';

export default PropTypes.shape({
  column: columnType.isRequired,
  aggregate: PropTypes.oneOfType([
    PropTypes.oneOf(Object.keys(AGGREGATES)),
    PropTypes.oneOf(Object.values(AGGREGATES_SUB_TOTALS)),
  ]).isRequired,
  label: PropTypes.string.isRequired,
  customAggregateLabel: PropTypes.string,
});
