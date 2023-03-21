import React, { PropTypes } from 'react';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import SelectControl from './SelectControl';
import { t } from '../../../locales';

const $ = (window.$ = require('jquery'));

const operatorsArr = [
  { val: 'in', type: 'array', useSelect: true, multi: true },
  { val: 'not in', type: 'array', useSelect: true, multi: true },
  { val: '==', type: 'string', useSelect: true, multi: false },
  { val: '!=', type: 'string', useSelect: true, multi: false },
  { val: '>=', type: 'string' },
  { val: '<=', type: 'string' },
  { val: '>', type: 'string' },
  { val: '<', type: 'string' },
  { val: 'regex', type: 'string', datasourceTypes: ['druid'] },
  { val: 'LIKE', type: 'string', datasourceTypes: ['table'] },
];
const operators = {};
operatorsArr.forEach((op) => {
  operators[op.val] = op;
});

const propTypes = {
  changeFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  filter: PropTypes.object.isRequired,
  datasource: PropTypes.object,
};

const defaultProps = {
  changeFilter: () => {},
  removeFilter: () => {},
  datasource: null,
};

export default class FilterWithGroup extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedGroup: null,
      groups: this.props.datasource.column_groups,
      valuesLoading: false,
      colChoices: this.props.datasource
        ? this.props.datasource.filterable_cols.map((c) => {
            const value = c[0];
            const meta = this.props.datasource.columns.find(
              columnMeta => columnMeta.column_name === value,
            );
            return { value, label: (meta && meta.verbose_name) || value };
          })
        : null,
    };
  }
  componentDidMount() {
    this.fetchFilterValues(this.props.filter.col);
  }

  onGroupChange(selectedGroup) {
    let colChoices = this.props.datasource
      ? this.props.datasource.filterable_cols.map((c) => {
          const value = c[0];
          const meta = this.props.datasource.columns.find(
            columnMeta => columnMeta.column_name === value,
          );
          return {
            value: c[0],
            label: (meta && meta.verbose_name) || c[1],
          };
        })
      : null;
    if (selectedGroup) {
      colChoices = colChoices.filter(
        o =>
          this.state.groups[selectedGroup.value].columns.indexOf(o.value) >= 0,
      );
    }
    this.setState({ colChoices, selectedGroup });
  }

  changeSelect(value) {
    this.props.changeFilter('val', value);
  }
  changeColumn(event) {
    this.props.changeFilter('col', event.value);
    this.fetchFilterValues(event.value);
  }
  changeOp(event) {
    this.switchFilterValue(this.props.filter.op, event.value);
    this.props.changeFilter('op', event.value);
  }
  removeFilter(filter) {
    this.props.removeFilter(filter);
  }

  changeText(event) {
    this.props.changeFilter('val', event.target.value);
  }

  switchFilterValue(prevOp, nextOp) {
    if (operators[prevOp].type !== operators[nextOp].type) {
      const val = this.props.filter.value;
      let newVal;
      // switch from array to string
      if (operators[nextOp].type === 'string' && val && val.length > 0) {
        newVal = val[0];
      } else if (operators[nextOp].type === 'string' && val) {
        newVal = [val];
      }
      this.props.changeFilter('val', newVal);
    }
  }

  fetchFilterValues(col) {
    const datasource = this.props.datasource;
    if (col && this.props.datasource && this.props.datasource.filter_select) {
      this.setState({ valuesLoading: true });
      $.ajax({
        type: 'GET',
        url: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
        success: (data) => {
          this.setState({ valuesLoading: false, valueChoices: data });
        },
      });
    }
  }

  renderFilterFormControl(filter) {
    const operator = operators[filter.op];
    if (operator.useSelect) {
      return (
        <SelectControl
          multi={operator.multi}
          freeForm
          name="filter-value"
          value={filter.val}
          isLoading={this.state.valuesLoading}
          choices={this.state.valueChoices}
          onChange={this.changeSelect.bind(this)}
        />
      );
    }
    return (
      <input
        type="text"
        onChange={this.changeText.bind(this)}
        value={filter.val}
        className="form-control input-sm"
        placeholder={t('Filter value')}
      />
    );
  }
  render() {
    const datasource = this.props.datasource;
    const filter = this.props.filter;
    const opsChoices = operatorsArr
      .filter(
        o =>
          !o.datasourceTypes || o.datasourceTypes.indexOf(datasource.type) >= 0,
      )
      .map(o => ({ value: o.val, label: o.val }));
    const verboseValueLabel =
      (datasource.columns.find(item => item.column_name === filter.col) || {})
        .verbose_name || filter.col;
    return (
      <div>
        <Row className="space-1">
          <Col md={12}>
            <Select
              placeholder={t('Column Group')}
              options={Object.keys(this.state.groups || {}).map(k => ({
                value: k,
                label: this.state.groups[k].label,
              }))}
              value={this.state.selectedGroup}
              onChange={v => this.onGroupChange(v)}
            />
            <Select
              id="select-col"
              placeholder={t('Select column')}
              clearable={false}
              options={this.state.colChoices}
              value={{ value: filter.col, label: verboseValueLabel }}
              onChange={this.changeColumn.bind(this)}
            />
          </Col>
        </Row>
        <Row className="space-1">
          <Col md={3}>
            <Select
              id="select-op"
              placeholder={t('Select operator')}
              options={opsChoices}
              clearable={false}
              value={filter.op}
              onChange={this.changeOp.bind(this)}
            />
          </Col>
          <Col md={7}>{this.renderFilterFormControl(filter)}</Col>
          <Col md={2}>
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeFilter.bind(this)}
            >
              <i className="fa fa-minus" />
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

FilterWithGroup.propTypes = propTypes;
FilterWithGroup.defaultProps = defaultProps;
