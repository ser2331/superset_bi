import React from 'react';
import PropTypes from 'prop-types';

import controlMap from './controls';
import { getMaxOfRecords } from "../../../visualizations/table";
import { getMinMaxLineChartValuesY } from "../../../visualizations/nvd3_vis";
import { getMaxValuePivotTabe } from '../../../visualizations/pivot_table'
const controlTypes = Object.keys(controlMap);
import AdhocMetric from '../../../javascripts/explore/AdhocMetric';

const propTypes = {
  actions: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(controlTypes).isRequired,
  hidden: PropTypes.bool,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  ),
  description: PropTypes.string,
  tooltipOnClick: PropTypes.func,
  places: PropTypes.number,
  validators: PropTypes.array,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.object,
    PropTypes.bool,
    PropTypes.array,
    PropTypes.func]),
    controls: PropTypes.object.isRequired,
};

const defaultProps = {
  renderTrigger: false,
  validators: [],
  hidden: false,
  validationErrors: [],
  controls: {}
};

export default class Control extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hovered: false };
    this.validate = this.validate.bind(this);
    this.onChange = this.onChange.bind(this);
  }
  componentDidMount() {
    this.validateAndSetValue(this.props.value, []);
  }

  componentDidUpdate(prevProps) {
    let maxValueForConditionalFormatting;
    if (this.props?.name === 'speedometer_sectors') {
      maxValueForConditionalFormatting = this.props.slice?.queryResponse?.data?.data?.[0]?.[0] !== prevProps.slice?.queryResponse?.data?.data?.[0]?.[0] && this.props.slice?.queryResponse?.data?.data?.[0]?.[0]
    }
    if (this.props?.name === 'conditional_formatting' && this.props?.vizType === 'table') {
      const records = this.props.slice?.queryResponse?.data?.records !== prevProps.slice?.queryResponse?.data?.records && this.props.slice?.queryResponse?.data?.records
      maxValueForConditionalFormatting = records ? getMaxOfRecords(records) : undefined
    }
    if (this.props?.name === 'conditional_formatting' && this.props?.vizType === 'line') {
      maxValueForConditionalFormatting = this.props.slice?.queryResponse?.data !== prevProps.slice?.queryResponse?.data && this.props.slice?.queryResponse?.data
    }
    if (this.props?.name === 'conditional_formatting' && this.props?.vizType === 'pivot_table') {
      maxValueForConditionalFormatting = getMaxValuePivotTabe(this.props.slice?.queryResponse?.data?.html) !==  getMaxValuePivotTabe(prevProps.slice?.queryResponse?.data?.html)  && getMaxValuePivotTabe(this.props.slice?.queryResponse?.data?.html);
    }
    if (maxValueForConditionalFormatting) {
      this.validateAndSetValue(this.props.value, []);
    }
  }

  onChange(value, errors) {
    this.validateAndSetValue(value, errors);
  }
  setHover(hovered) {
    this.setState({ hovered });
  }
  validateAndSetValue(value, errors) {
    let validationErrors = this.props.validationErrors;
    let currentErrors = this.validate(value);
    if (errors && errors.length > 0) {
      currentErrors = validationErrors.concat(errors);
    }
    if (validationErrors.length + currentErrors.length > 0) {
      validationErrors = currentErrors;
    }

    const isConditionalFormattingPercentageChanged = this.props.name === 'conditional_formatting_percentage';

    if (value !== this.props.value || validationErrors !== this.props.validationErrors) {
      if (this.props.vizType === 'pie' && this.props.name === 'limit') { // В круговой диаграмме не распознается поле limit, поэтому дополнительно отправляем поле row_limit
        this.props.actions.setControlValue('row_limit', value, validationErrors);
      }

      // setControlValue
      if (isConditionalFormattingPercentageChanged) {
        let newValue = this.props.controls?.conditional_formatting?.value || [];
        let newName = 'conditional_formatting';
        if (this.props.vizType === 'speedometer') {
          newValue = this.props.controls?.speedometer_sectors?.value || []
          newName = 'speedometer_sectors';
        }
        this.props.actions.setControlValue(newName, newValue, validationErrors);
        this.props.actions.setControlValue(this.props.name, value, []);
      } else {
        this.props.actions.setControlValue(this.props.name, value, validationErrors);
      }
    }

    if (this.props.type === 'MetricsControl') {

      const formattedMetrics = (metrics = []) => metrics.filter(obj => obj instanceof AdhocMetric || obj.aggregate).map(m => ([m.label, m.label]));

      const metrics = value ? formattedMetrics(value instanceof Array ? value : [value]) : [];
      if (metrics && metrics.length) {
        this.props.actions.setDrilldownMetrics(metrics);
      }
    }
  }
  validate(value) {
    const validators = this.props.validators;
    const validationErrors = [];
    const { name, vizType, slice } = this.props;
    if (validators?.length) {
      validators.forEach((validatorFunction) => {
        let errorMessage;
        let conditional_formatting_percentage = this.props.controls.conditional_formatting_percentage?.value || false;
        if (name === 'speedometer_sectors') {
          const maxValueFromResponse = slice?.queryResponse?.data?.data?.[0]?.[0] || 0;
          errorMessage = validatorFunction(value, maxValueFromResponse, conditional_formatting_percentage);
        } else if (name === 'conditional_formatting' || name === 'conditional_formatting_percentage') {
          const isConditionalFormattingPercentageChanged = name === 'conditional_formatting_percentage';
          let newValue = value;
          if (isConditionalFormattingPercentageChanged) {
            newValue = this.props.controls?.conditional_formatting?.value || [];
            conditional_formatting_percentage = !conditional_formatting_percentage;
          }
          if (vizType === 'table') {
            const records = slice?.queryResponse?.data?.records;
            const maxValueFromResponse = records ? getMaxOfRecords(records) : 0;
            errorMessage = validatorFunction(newValue, maxValueFromResponse, conditional_formatting_percentage);
          }
          if (vizType === 'line') {
            let data = slice?.queryResponse?.data;
            data = Array.isArray(data) ? data : [];
            const minMaxLineChartValuesY = getMinMaxLineChartValuesY(data);
            const maxValueFromResponse = minMaxLineChartValuesY?.max || 0;
            errorMessage = validatorFunction(newValue, maxValueFromResponse, conditional_formatting_percentage);
          }
          if (vizType === 'pivot_table') {
            const max =  getMaxValuePivotTabe(this.props.slice?.queryResponse?.data?.html);
            if (slice?.latestQueryFormData.groupby?.length === 0) {
              errorMessage = validatorFunction(newValue, max, false);
            } else {
              errorMessage = validatorFunction(newValue, max, conditional_formatting_percentage);
            }
          }
          if (vizType === 'speedometer') {
            const maxValueFromResponse = slice?.queryResponse?.data?.data?.[0]?.[0] || 0;
            const newValue = this.props.controls?.speedometer_sectors?.value;
            errorMessage = validatorFunction(newValue, maxValueFromResponse, conditional_formatting_percentage);
          }
        } else {
          errorMessage = validatorFunction(value);
        }
        if (errorMessage) {
          validationErrors.push(errorMessage);
        }
      });
    }
    return validationErrors;
  }
  render() {
    const ControlType = controlMap[this.props.type];
    const divStyle = this.props.hidden ? { display: 'none' } : null;
    return (
      <div
        style={divStyle}
        onMouseEnter={this.setHover.bind(this, true)}
        onMouseLeave={this.setHover.bind(this, false)}
      >
        {this.props.vizType === 'yandex_heat_map' &&
        this.props.name === 'opacity' ? (
          <div className="example">
            <div className="example-20"></div>
            <div className="example-100"></div>
          </div>
        ) : null}
        <ControlType
          onChange={this.onChange}
          hovered={this.state.hovered}
          {...this.props}
        />
      </div>
    );
  }
}

Control.propTypes = propTypes;
Control.defaultProps = defaultProps;
