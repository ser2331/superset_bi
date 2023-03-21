import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Popover } from 'react-bootstrap';
import VirtualizedSelect from 'react-virtualized-select';

import { AGGREGATES_SUB_TOTALS } from '../constants';
import { t, tn } from '../../locales';
import VirtualizedRendererWrap from '../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../components/OnPasteSelect';
import AdhocMetric from '../AdhocMetric';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default class AdhocMetricSubTotalEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onColumnChange = this.onColumnChange.bind(this);
    this.onAggregateChange = this.onAggregateChange.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.state = { adhocMetric: this.props.adhocMetric };
    this.selectProps = {
      multi: false,
      name: 'select-column',
      labelKey: 'label',
      autosize: false,
      clearable: true,
      selectWrap: VirtualizedSelect,
      useOnlyExistingOnPaste: true,
    };
  }

  onSave() {
    this.props.onChange(this.state.adhocMetric);
    this.props.onClose();
  }

  onColumnChange(column) {
    this.setState({ adhocMetric: this.state.adhocMetric.duplicateWith({ column }) });
  }

  onAggregateChange(aggregate) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        aggregate: aggregate && aggregate.aggregate,
        customAggregateLabel: aggregate && aggregate.label,
      }),
    });
  }

  onLabelChange(e) {
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        label: e.target.value, hasCustomLabel: true,
      }),
    });
  }

  render() {
    const { adhocMetric, onChange, onClose, ...popoverProps } = this.props;

    const options = Object.keys(AGGREGATES_SUB_TOTALS).map(key => ({
      label: AGGREGATES_SUB_TOTALS[key],
      aggregate: key,
    }));

    const aggregateSelectProps = {
      placeholder: tn('%s aggregates(s)', '%s aggregates(s)', options.length),
      options,
      value: this.state.adhocMetric.aggregate,
      onChange: this.onAggregateChange,
      optionRenderer: VirtualizedRendererWrap(aggregate => aggregate.label),
      valueRenderer: aggregate => aggregate.label,
      valueKey: 'aggregate',
    };

    const stateIsValid = this.state.adhocMetric.column && this.state.adhocMetric.aggregate;
    const hasUnsavedChanges = this.state.adhocMetric.equals(this.props.adhocMetric);

    return (
      <Popover
        id="metrics-edit-popover"
        title={t('Aggregation function')}
        {...popoverProps}
      >
        <FormGroup>
          <OnPasteSelect {...this.selectProps} {...aggregateSelectProps} />
        </FormGroup>
        <Button
          disabled={!stateIsValid}
          bsStyle={(hasUnsavedChanges || !stateIsValid) ? 'default' : 'primary'}
          bsSize="small"
          className="m-r-5"
          onClick={this.onSave}
        >
          {t('Save')}
        </Button>
        <Button bsSize="small" onClick={this.props.onClose}>
          {t('Close')}
        </Button>
      </Popover>
    );
  }
}
AdhocMetricSubTotalEditPopover.propTypes = propTypes;
