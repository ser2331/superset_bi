import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import _ from 'lodash';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import OnPasteSelect from '../../../components/OnPasteSelect';
import MetricDefinitionValue from '../MetricDefinitionValue';
import AdhocMetric from '../../AdhocMetric';
import adhocMetricType from '../../propTypes/adhocMetricType';
import { BASE_AGGREGATES } from "../../constants";
import AdhocMetricSubTotalEditPopover from '../AdhocMetricSubTotalEditPopover';

const metricSubTotalType = PropTypes.shape({
  label: PropTypes.string,
  optionName: PropTypes.string,
});

const propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, adhocMetricType])),
    PropTypes.oneOfType([PropTypes.string, adhocMetricType]),
  ]),
  metrics: PropTypes.oneOfType([PropTypes.arrayOf(metricSubTotalType), metricSubTotalType]),
  multi: PropTypes.bool,
};

const defaultProps = {
  onChange: () => {},
};

function isDictionaryForAdhocMetric(value) {
  return value && !(value instanceof AdhocMetric) && value.column && value.aggregate && value.label;
}

// adhoc metrics are stored as dictionaries in URL params. We convert them back into the
// AdhocMetric class for typechecking, consistency and instance method access.
function coerceAdhocMetrics(value) {
  if (!value) {
    return [];
  }
  if (!Array.isArray(value)) {
    if (isDictionaryForAdhocMetric(value)) {
      return [new AdhocMetric(value)];
    }
    return [value];
  }
  return value.map((val) => {
    if (isDictionaryForAdhocMetric(val)) {
      return new AdhocMetric(val);
    }
    return val;
  });
}

export default class MetricsSubTotalControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onMetricEdit = this.onMetricEdit.bind(this);
    this.optionsForSelect = this.optionsForSelect.bind(this);
    this.selectFilterOption = this.selectFilterOption.bind(this);
    this.valueRenderer = (option) => (
      <MetricDefinitionValue
        option={option}
        onMetricEdit={this.onMetricEdit}
        Popover={AdhocMetricSubTotalEditPopover}
        multi={this.props.multi}
      />
    );
    this.refFunc = (ref) => {
      if (ref) {
        // eslint-disable-next-line no-underscore-dangle
        this.select = ref._selectRef;
      }
    };
    this.state = {
      aggregateInInput: null,
      options: this.optionsForSelect(this.props),
      value: coerceAdhocMetrics(this.props.value),
      selectedGroup: null,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(this.props.metrics, nextProps.metrics)) {
      const { value: currentValue } = this.state;
      const newValue = currentValue.filter((value) => {
        const { optionName } = value;
        return !!_.find(nextProps.metrics, (metric) => metric.optionName === optionName);
      });
      this.setState({ options: this.optionsForSelect(nextProps) });
      this.props.onChange(newValue);
    }
    if (!_.isEqual(this.props.value, nextProps.value)) {
      this.setState({ value: coerceAdhocMetrics(nextProps.value) });
    }
  }

  onMetricEdit(changedMetric) {
    let newValue = this.state.value.map((value) => {
      if (value.optionName === changedMetric.optionName) {
        return changedMetric;
      }
      return value;
    });
    if (!this.props.multi) {
      newValue = newValue[0];
    }
    this.props.onChange(newValue);
  }

  onChange(opts) {
    let transformedOpts = opts;

    if (!this.props.multi) {
      transformedOpts = [opts].filter((option) => option);
    }
    let optionValues = transformedOpts
      .map((option) => {
        if (option instanceof AdhocMetric) {
          return option;
        }
        return new AdhocMetric({
          column: { option, column_name: option.label },
          optionName: option.optionName,
          aggregate: BASE_AGGREGATES.SUM,
        });
      })
      .filter((option) => option);
    if (!this.props.multi) {
      optionValues = optionValues[0];
    }
    this.props.onChange(optionValues);
  }

  optionsForSelect(props) {
    const options = [...props.metrics];
    return options;
  }

  selectFilterOption(option, filterValue) {
    const { label } = option;
    return label && label.toLowerCase().match(filterValue.toLowerCase());
  }

  render() {
    const options =
      this.state.options && Array.isArray(this.state.options)
        ? this.state.options.filter((option) => {
            const { optionName } = option;
            return !_.find(this.state.value, (value) => value.optionName === optionName);
          })
        : [];
    return (
      <div className='metrics-select'>
        <ControlHeader {...this.props} />
        <OnPasteSelect
          multi={this.props.multi}
          name={`select-${this.props.name}`}
          placeholder={t('Choose the metric')}
          options={options}
          value={this.props.multi ? this.state.value : this.state.value[0]}
          labelKey='label'
          valueKey='optionName'
          clearable
          closeOnSelect
          onChange={this.onChange}
          valueRenderer={this.valueRenderer}
          filterOption={this.selectFilterOption}
          refFunc={this.refFunc}
          selectWrap={VirtualizedSelect}
          useOnlyExistingOnPaste
        />
      </div>
    );
  }
}

MetricsSubTotalControl.propTypes = propTypes;
MetricsSubTotalControl.defaultProps = defaultProps;
