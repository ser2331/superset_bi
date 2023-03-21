import React from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, FormControl, OverlayTrigger, Popover,
} from 'react-bootstrap';
import Select from 'react-select';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import BoundsControl from './BoundsControl';
import { t } from '../../../locales';

const propTypes = {
  onChange: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
};

const comparisonTypeOptions = [
  { value: 'value', label: t('Actual value') },
  { value: 'diff', label: t('Difference') },
  { value: 'perc', label: t('Percentage') },
  { value: 'perc_change', label: t('Percentage Change') },
];

const colTypeOptions = [
  { value: 'time', label: t('Time Comparison') },
  { value: 'contrib', label: t('Contribution') },
  { value: 'spark', label: t('Sparkline') },
  { value: 'avg', label: t('Period Average') },
];

export default class TimeSeriesColumnControl extends React.Component {
  constructor(props) {
    super(props);
    const state = { ...props };
    delete state.onChange;
    this.state = state;
    this.onChange = this.onChange.bind(this);
  }
  onChange() {
    this.props.onChange(this.state);
  }
  onSelectChange(attr, opt) {
    this.setState({ [attr]: opt.value }, this.onChange);
  }
  onTextInputChange(attr, event) {
    this.setState({ [attr]: event.target.value }, this.onChange);
  }
  onBoundsChange(bounds) {
    this.setState({ bounds }, this.onChange);
  }
  setType() {
  }
  textSummary() {
    return `${this.state.label || 'Пусто'}`;
  }
  edit() {
  }
  formRow(label, tooltip, ttLabel, control) {
    return (
      <Row style={{ marginTop: '5px' }}>
        <Col md={5}>
          {`${label} `}
          <InfoTooltipWithTrigger
            placement="top"
            tooltip={tooltip}
            label={ttLabel}
          />
        </Col>
        <Col md={7}>{control}</Col>
      </Row>
    );
  }
  renderPopover() {
    return (
      <Popover id="ts-col-popo" title={t('Column Configuration')}>
        <div style={{ width: 300 }}>
          {this.formRow(
            t('Label'),
            t('The column header label'),
            'time-lag',
            <FormControl
              value={this.state.label}
              onChange={this.onTextInputChange.bind(this, 'label')}
              bsSize="small"
              placeholder={t('Label')}
            />,
          )}
          {this.formRow(
            t('Tooltip'),
            t('Column header tooltip'),
            'col-tooltip',
            <FormControl
              value={this.state.tooltip}
              onChange={this.onTextInputChange.bind(this, 'tooltip')}
              bsSize="small"
              placeholder={t('Tooltip')}
            />,
          )}
          {this.formRow(
            t('Type'),
            t('Type of comparison, value difference or percentage'),
            'col-type',
            <Select
              value={this.state.colType}
              clearable={false}
              onChange={this.onSelectChange.bind(this, 'colType')}
              options={colTypeOptions}
              placeholder={t('Select ...')}
            />,
          )}
          <hr />
          {this.state.colType === 'spark' && this.formRow(
            t('Width'),
            t('Width of the sparkline'),
            'spark-width',
            <FormControl
              value={this.state.width}
              onChange={this.onTextInputChange.bind(this, 'width')}
              bsSize="small"
              placeholder={t('Width')}
            />,
          )}
          {this.state.colType === 'spark' && this.formRow(
            t('Height'),
            t('Height of the sparkline'),
            'spark-width',
            <FormControl
              value={this.state.height}
              onChange={this.onTextInputChange.bind(this, 'height')}
              bsSize="small"
              placeholder={t('height')}
            />,
          )}
          {['time', 'avg'].indexOf(this.state.colType) >= 0 && this.formRow(
            t('Time Lag'),
            t('Number of periods to compare against'),
            'time-lag',
            <FormControl
              value={this.state.timeLag}
              onChange={this.onTextInputChange.bind(this, 'timeLag')}
              bsSize="small"
              placeholder={t('Time Lag')}
            />,
          )}
          {['spark'].indexOf(this.state.colType) >= 0 && this.formRow(
            t('Time Ratio'),
            t('Number of periods to ratio against'),
            'time-ratio',
            <FormControl
              value={this.state.timeRatio}
              onChange={this.onTextInputChange.bind(this, 'timeRatio')}
              bsSize="small"
              placeholder={t('Time Lag')}
            />,
          )}
          {this.state.colType === 'time' && this.formRow(
            t('Type'),
            t('Type of comparison, value difference or percentage'),
            'comp-type',
            <Select
              value={this.state.comparisonType}
              clearable={false}
              onChange={this.onSelectChange.bind(this, 'comparisonType')}
              options={comparisonTypeOptions}
            />,
          )}
          {this.state.colType !== 'spark' && this.formRow(
            t('Color bounds'),
            (
              t('Number bounds used for color encoding from red to blue. ' +
              'Reverse the numbers for blue to red. To get pure red or blue, ' +
              'you can enter either only min or max.')
            ),
            'bounds',
            <BoundsControl
              value={this.state.bounds}
              onChange={this.onBoundsChange.bind(this)}
            />,
          )}
          {this.formRow(
            t('Number format'),
            t('Optional d3 number format string'),
            'd3-format',
            <FormControl
              value={this.state.d3format}
              onChange={this.onTextInputChange.bind(this, 'd3format')}
              bsSize="small"
              placeholder={t('Number format string')}
            />,
          )}
          {this.state.colType === 'spark' && this.formRow(
            t('Date format'),
            t('Optional d3 date format string'),
            'date-format',
            <FormControl
              value={this.state.dateFormat}
              onChange={this.onTextInputChange.bind(this, 'dateFormat')}
              bsSize="small"
              placeholder={t('Date format string')}
            />,
          )}
        </div>
      </Popover>
    );
  }
  render() {
    return (
      <span>
        {this.textSummary()}{' '}
        <OverlayTrigger
          container={document.body}
          trigger="click"
          rootClose
          ref="trigger"
          placement="right"
          overlay={this.renderPopover()}
        >
          <InfoTooltipWithTrigger
            icon="edit"
            className="text-primary"
            onClick={this.edit.bind(this)}
            label="edit-ts-column"
          />
        </OverlayTrigger>
      </span>
    );
  }
}

TimeSeriesColumnControl.propTypes = propTypes;
TimeSeriesColumnControl.defaultProps = defaultProps;
