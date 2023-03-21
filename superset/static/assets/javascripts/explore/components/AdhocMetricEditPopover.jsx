import React from "react";
import PropTypes from "prop-types";
import { Button, ControlLabel, FormGroup, Popover } from "react-bootstrap";
import VirtualizedSelect from "../../components/VirtualizedSelectDecorator";
import { Creatable as CreatableSelect } from "react-select";

import { AGGREGATES } from "../constants";
import { t, tn } from "../../locales";
import VirtualizedRendererWrap from "../../components/VirtualizedRendererWrap";
import OnPasteSelect from "../../components/OnPasteSelect";
import AdhocMetricEditPopoverTitle from "./AdhocMetricEditPopoverTitle";
import columnType from "../propTypes/columnType";
import AdhocMetric from "../AdhocMetric";
import ColumnOption from "../../components/ColumnOption";
import Checkbox from '../../../javascripts/components/Checkbox';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  datasourceType: PropTypes.string,
  vizType: PropTypes.string.isRequired,
};

const defaultProps = {
  columns: [],
};

const D3_FORMAT_OPTIONS = [
  ['.0f', '.0f | 1234567890 '],
  ['.1s', '.1s | 12k'],
  ['.3s', '.3s | 12.3k'],
  ['.1%', '.1% | 12.3%'],
  ['.3%', '.3% | 1234543.210%'],
  ['.4r', '.4r | 12350'],
  ['.3f', '.3f | 12345.432'],
  ['+,', '+, | +12,345.4321'],
  ['$,.2f', '$,.2f | $12,345.43'],
];

export const numberFormatOptions = D3_FORMAT_OPTIONS.map(option => ({
  value: option[0],
  label: option[1],
}));


export const AGGREGATES_CUMULATIVE = {
  COUNT_DISTINCT: t('COUNT_DISTINCT'),
  MAX: t('MAX'),
  MIN: t('MIN'),
  SUM: t('SUM'),
  AVG: t('AVG'),
  COUNT: t('COUNT'),
};



const getAggregateOptions = (vizType, state) => {
  if (vizType === "bar") {
    let items = Object.keys(AGGREGATES_CUMULATIVE);
    if (state.aggregateCheckbox) {
      items = Object.keys(AGGREGATES_CUMULATIVE).filter(
        (el) => el !== "AVG" && el !== "COUNT"
      );
      return items.map((aggregate) => ({ aggregate, label: t(aggregate) }));
    }
    return items.map((aggregate) => ({ aggregate, label: t(aggregate) }));
  } else {
    let items = Object.keys(AGGREGATES);
    return items.map((aggregate) => ({ aggregate, label: t(aggregate) }));
  }
};

export default class AdhocMetricEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onColumnChange = this.onColumnChange.bind(this);
    this.onAggregateChange = this.onAggregateChange.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.onNumberFormatChange = this.onNumberFormatChange.bind(this);
    this.handleAggregateCheckbox = this.handleAggregateCheckbox.bind(this);
    this.state = { adhocMetric: this.props.adhocMetric, aggregateCheckbox: this.props.adhocMetric.cumulativeTotal };
    this.selectProps = {
      multi: false,
      name: "select-column",
      labelKey: "label",
      autosize: false,
      clearable: true,
      selectWrap: VirtualizedSelect,
      useOnlyExistingOnPaste: true,
    };
  }


  componentDidUpdate(prevProps, prevState){
    if(prevState.aggregateCheckbox !== this.state.aggregateCheckbox){
      if(this.state.aggregateCheckbox && this.state.adhocMetric.aggregate === "AVG" ||
         this.state.aggregateCheckbox && this.state.adhocMetric.aggregate === "COUNT") {
        this.setState({
          adhocMetric: this.state.adhocMetric.duplicateWith({
            aggregate: "COUNT_DISTINCT",
          }),
        });
      }
    }
  }

  onSave() {
    this.props.onChange(this.state.adhocMetric);
    this.props.onClose();
  }

  onColumnChange(column) {
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({ column }),
    });
  }

  onAggregateChange(aggregate) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        aggregate: aggregate && aggregate.aggregate,
      }),
    });
  }

  onLabelChange(e) {
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        label: e.target.value,
        hasCustomLabel: true,
      }),
    });
  }

  onNumberFormatChange(newValue) {
    const customNumberFormat = newValue === null ? {value: '', label: ''} : newValue
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        customNumberFormat,
      }),
    });
  }

  handleAggregateCheckbox() {
    this.setState({
      aggregateCheckbox: !this.state.aggregateCheckbox,
      adhocMetric: this.state.adhocMetric.duplicateWith({
        cumulativeTotal: !this.state.aggregateCheckbox,
      }),
    });
  }

  render() {

    const {
      adhocMetric,
      columns,
      onChange,
      onClose,
      datasourceType,
      vizType,
      ...popoverProps
    } = this.props;
    const columnSelectProps = {
      placeholder: tn("%s column(s)", "%s column(s)", columns.length),
      options: columns,
      value:
        this.state.adhocMetric.column &&
        this.state.adhocMetric.column.column_name,
      onChange: this.onColumnChange,
      optionRenderer: VirtualizedRendererWrap((option) => (
        <ColumnOption column={option} showType />
      )),
      valueRenderer: (column) => column.verbose_name || column.column_name,
      valueKey: "column_name",
      filterOption: (option, filter) => {
        if (filter && filter.length) {
          let coincidenceVerboseName = false;
          let coincidenceColumnName = false;
          const { verbose_name: verboseName, column_name: columnName } = option;
          if (verboseName) {
            coincidenceVerboseName =
              verboseName.toLowerCase().indexOf(filter.toLowerCase()) > -1;
          }
          if (columnName) {
            coincidenceColumnName =
              columnName.toLowerCase().indexOf(filter.toLowerCase()) > -1;
          }
          return coincidenceVerboseName || coincidenceColumnName;
        }
        return true;
      },
    };

    const aggregateSelectProps = {
      placeholder: tn(
        "%s aggregates(s)",
        "%s aggregates(s)",
        getAggregateOptions(vizType, this.state).length
      ),
      options: getAggregateOptions(vizType, this.state),
      value: this.state.adhocMetric.aggregate,
      onChange: this.onAggregateChange,
      optionRenderer: VirtualizedRendererWrap(
        (aggregate) => aggregate.label || aggregate.aggregate
      ),
      valueRenderer: (aggregate) => aggregate.label || aggregate.aggregate,
      valueKey: "aggregate",
    };

    const numberFormatSelectProps = {
      placeholder: t("Number format"),
      value:
        this.state.adhocMetric?.customNumberFormat.value === '' ? '' : (
        this.state.adhocMetric?.customNumberFormat ||
        adhocMetric.customNumberFormat ||
        numberFormatOptions[1]),
      options: numberFormatOptions,
      onChange: this.onNumberFormatChange,
    };

    if (this.props.datasourceType === "druid") {
      aggregateSelectProps.options = aggregateSelectProps.options.filter(
        (option) => option.aggregate !== "AVG"
      );
    }

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        adhocMetric={this.state.adhocMetric}
        onChange={this.onLabelChange}
      />
    );

    const stateIsValid =
      this.state.adhocMetric.column && this.state.adhocMetric.aggregate;
    const hasUnsavedChanges = this.state.adhocMetric.equals(
      this.props.adhocMetric
    );

    const shouldRenderFormatNumberSelect =
      vizType === "table" || vizType === "pivot_table";

    return (
      <Popover id="metrics-edit-popover" title={popoverTitle} {...popoverProps}>
        <FormGroup>
          <ControlLabel>
            <strong>{t("Column")}</strong>
          </ControlLabel>
          <OnPasteSelect {...this.selectProps} {...columnSelectProps} />
        </FormGroup>
        <FormGroup>
          <ControlLabel>
            <strong>{t("Aggregate")}</strong>
            {vizType === "bar" && (
              <span>
                {" "}
                <Checkbox checked={this.state.aggregateCheckbox} onChange={this.handleAggregateCheckbox} />
                  {" "}
                  {t('cumulative total')}
              </span>
            )}
          </ControlLabel>
          <OnPasteSelect {...this.selectProps} {...aggregateSelectProps} />
        </FormGroup>
        {shouldRenderFormatNumberSelect && (
          <FormGroup>
            <ControlLabel>
              <strong>{t("Number format")}</strong>
            </ControlLabel>
            <CreatableSelect {...numberFormatSelectProps} isClearable />
          </FormGroup>
        )}
        <Button
          disabled={!stateIsValid}
          bsStyle={hasUnsavedChanges || !stateIsValid ? "default" : "primary"}
          bsSize="small"
          className="m-r-5"
          onClick={this.onSave}
        >
          {t("Save")}
        </Button>
        <Button bsSize="small" onClick={this.onSave}>
          {t("Close")}
        </Button>
      </Popover>
    );
  }
}
AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;
