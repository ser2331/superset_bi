import React, { PropTypes } from 'react';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import moment from 'moment';
import { connect } from 'react-redux';

import SelectControl from './SelectControl';
import { t } from '../../../locales';
import { dateFormats, sqlDateFormats, dateTypes } from '../../../../constants/common';

const $ = (window.$ = require('jquery'));

export const URL_FETCH_TABLES = '/superset/get_table_filters/';
export const OPERATOR_VALUE_IN_TABLE = 'intable';

const operatorsArr = [
  { val: 'in', type: 'array', useSelect: true, multi: true },
  {
    val: OPERATOR_VALUE_IN_TABLE,
    label: 'in table',
    type: 'string',
    multi: false,
  },
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

class FilterWithGroup extends React.Component {
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
              (columnMeta) => columnMeta.column_name === value
            );
            return { value, label: (meta && meta.verbose_name) || value };
          })
        : null,
      valueChoices: [],
      customChoices: [],
      inputValue: '',
      page: 0,
      total_rows: 0,
      left: 0,
      next: '',
      prev: '',
      noResultsText: false,
      tables: [],
    };
    this.timeout = null;
    this.limit = 10;

    this.changeSelect = this.changeSelect.bind(this);
    this.onInputChange = this.onInputChange.bind(this);
    this.fetchAutocompleteFilterValues = this.fetchAutocompleteFilterValues.bind(this);
    this.renderMenu = this.renderMenu.bind(this);
    this.loadMoreFilterValues = this.loadMoreFilterValues.bind(this);
    this.clearFilterValues = this.clearFilterValues.bind(this);
    this.changeColumn = this.changeColumn.bind(this);
    this.changeOp = this.changeOp.bind(this);
    this.removeFilter = this.removeFilter.bind(this);
    this.changeText = this.changeText.bind(this);
    this.clearChoices = this.clearChoices.bind(this);
    this.getDescriptionOption = this.getDescriptionOption.bind(this);
    this.getCreateOption = this.getCreateOption.bind(this);
  }
  componentDidMount() {
    this.fetchFilterValues(this.props.filter.col);
    this.fetchTables();
  }

  onGroupChange(selectedGroup) {
    let colChoices = this.props.datasource
      ? this.props.datasource.filterable_cols.map((c) => ({
          value: c[0],
          label: c[1],
        }))
      : null;
    if (selectedGroup) {
      colChoices = colChoices.filter(
        (o) => this.state.groups[selectedGroup.value].columns.indexOf(o.value) >= 0
      );
    }
    this.setState({ colChoices, selectedGroup });
  }

  getCurrentColumn() {
    const datasource = this.props.datasource;
    const filter = this.props.filter;
    return datasource.columns.find((column) => column.column_name === filter.col);
  }

  changeSelect(value) {
    const currentCol = this.getCurrentColumn();
    let val = value;
    const filter = this.props.filter;
    const operator = operators[filter.op];
    if (operator.useSelect) {
      if (
        operator.multi &&
        currentCol &&
        currentCol.hasOwnProperty('is_dttm') &&
        currentCol.is_dttm
      ) {
        val = value.map((v) =>
          moment(v).isValid()
            ? moment(v).format(
                sqlDateFormats[currentCol.type] || sqlDateFormats[dateTypes.DATETIME]
              )
            : v
        );
      } else if (val && currentCol && currentCol.hasOwnProperty('is_dttm') && currentCol.is_dttm) {
        val = moment(val).isValid()
          ? moment(val).format(
              sqlDateFormats[currentCol.type] || sqlDateFormats[dateTypes.DATETIME]
            )
          : val;
      }
    }
    this.props.changeFilter('val', val);
  }
  changeColumn(event) {
    this.props.changeFilter('col', event.value);
    this.fetchFilterValues(event.value);
    this.clearFilterValues();
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
    const { datasource } = this.props;
    if (col && datasource && datasource.filter_select) {
      this.setState({ valuesLoading: true });
      $.ajax({
        type: 'GET',
        url: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
        success: (data) => {
          this.setState({
            valuesLoading: false,
            valueChoices: [...this.state.valueChoices, ...data],
          });
        },
      });
    }
  }

  clearChoices() {
    this.setState({
      customChoices: [],
      valueChoices: [],
      tableChoices: [],
      next: false,
    });
  }

  getCreateOption(value) {
    return {
      label: value,
      value,
      isNotOption: true,
      getTemplate: (val) => `Добавить " ${val} "`,
    };
  }

  fetchTables() {
    this.setState({ valuesLoading: true });
    $.ajax({
      type: 'GET',
      url: URL_FETCH_TABLES,
      success: (data) => {
        this.setState({ valuesLoading: false, tables: data || [] });
      },
      error: () => {
        this.setState({ valuesLoading: false });
      },
    });
  }

  fetchAutocompleteFilterValues() {
    const { datasource, filter } = this.props;
    const { inputValue, page } = this.state;
    this.setState({ valuesLoading: true });
    let newState = { valuesLoading: false };
    $.ajax({
      type: 'GET',
      url: `/superset/get_column_data/${datasource.id}/${filter.col}/?text=${encodeURIComponent(
        inputValue
      )}&limit=${this.limit}&page=${page}`,
      success: (data) => {
        const createOption = this.getCreateOption(inputValue);

        if (data.status !== 'error') {
          const processedData = (data.values || []).map((d) => ({
            ...d,
            label: d.value,
          }));

          newState = {
            ...newState,
            valueChoices: [...this.state.valueChoices, ...processedData],
            customChoices: [createOption],
            left: parseInt(data.total) - this.state.page * this.limit,
            total_rows: data.total_rows,
            next: !!data.next_page,
            prev: !!data.prev_page,
          };
        } else {
          newState = {
            ...newState,
            valueChoices: [],
            customChoices: [createOption],
            next: false,
          };
        }
        this.setState(newState);
      },
      error: () => {
        this.setState(newState);
      },
    });
  }

  loadMoreFilterValues() {
    this.setState(
      {
        page: parseInt(this.state.page) + 1,
      },
      () => this.fetchAutocompleteFilterValues()
    );
  }

  clearFilterValues() {
    this.setState({ valueChoices: [] });
  }

  getDescriptionOption(label) {
    return {
      label,
      onClick: () => {},
      disabled: true,
      value: Date.now(),
      isNotOption: true,
      getTemplate: () => 'Впишите 3 символа для начала поиска',
    };
  }

  onInputChange(value) {
    if (this.timeout) clearTimeout(this.timeout);

    if (value.length >= 3) {
      this.setState(
        {
          inputValue: value,
          page: 0,
          noResultsText: '',
        },
        () => {
          this.timeout = setTimeout(() => this.fetchAutocompleteFilterValues(), 1000);
        }
      );
    } else if (value.length) {
      this.setState({
        customChoices: [this.getDescriptionOption(value), this.getCreateOption(value)],
        next: false,
      });
    }
  }

  renderMenu(params) {
    const { left, next, total_rows } = this.state;
    return (
      <div className='Select-menu-outer'>
        <div className='Select-menu' role='listbox'>
          {params.options.map((option) => {
            let style = {};
            if (option.count) {
              const perc = Math.round(option.count / (total_rows / 100));
              const backgroundImage =
                'linear-gradient(to right, lightgrey, ' +
                `lightgrey ${perc}%, rgba(0,0,0,0) ${perc}%`;
              style = {
                backgroundImage,
              };
            }

            return (
              <div
                key={option.value}
                onClick={() => (option.onClick ? option.onClick() : params.selectValue(option))}
                onMouseOver={() => params.focusOption(option)}
                className={`Select-option ${
                  params.focusedOption && params.focusedOption.value === option.value
                    ? 'is-focused'
                    : ''
                }`}
                role='option'
                style={style}
              >
                {option.getTemplate ? option.getTemplate(option.label) : option.label}
              </div>
            );
          })}

          {next ? (
            <div
              key='left'
              onClick={this.loadMoreFilterValues}
              className='Select-option load-more'
              role='option'
            >
              Ещё {left} значений. Показать ещё...
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  renderFilterFormControl(filter) {
    const operator = operators[filter.op];
    let value = filter.val;
    const currentCol = this.getCurrentColumn();
    if (operator?.val === OPERATOR_VALUE_IN_TABLE) {
      return (
        <Select
          refFunc={(ref) => {
            this.filterSelect = ref;
          }}
          name='filter-value'
          value={value}
          placeholder={t('Select table')}
          multi={false}
          onChange={this.changeSelect}
          options={this.state.tables.map((table) => {
            const [v, label] = table;
            return {
              value: v,
              label,
            };
          })}
        />
      );
    }
    if (operator?.useSelect) {
      if (
        operator.multi &&
        currentCol &&
        currentCol.hasOwnProperty('is_dttm') &&
        currentCol.is_dttm &&
        Array.isArray(filter.val)
      ) {
        value = filter.val.length
          ? filter.val.map((v) => ({
              label: moment(v).isValid()
                ? moment(v).format(dateFormats[currentCol.type] || dateFormats[dateTypes.DATETIME])
                : v,
              value: moment(v).isValid()
                ? moment(v).format(
                    sqlDateFormats[currentCol.type] || sqlDateFormats[dateTypes.DATETIME]
                  )
                : v,
            }))
          : filter.val;
      } else if (
        filter.val &&
        currentCol &&
        currentCol.hasOwnProperty('is_dttm') &&
        currentCol.is_dttm
      ) {
        value = filter.val
          ? {
              label: moment(filter.val).isValid()
                ? moment(filter.val).format(
                    dateFormats[currentCol.type] || dateFormats[dateTypes.DATETIME]
                  )
                : filter.val,
              value: moment(filter.val).isValid()
                ? moment(filter.val).format(
                    sqlDateFormats[currentCol.type] || sqlDateFormats[dateTypes.DATETIME]
                  )
                : filter.val,
            }
          : filter.val;
      }

      const valueChoices =
        filter && value && Array.isArray(value)
          ? [...this.state.valueChoices.concat(value)]
          : [...this.state.valueChoices];
      let allChoices = _.uniqBy([...valueChoices, ...this.state.customChoices], 'value');

      if (currentCol && currentCol.hasOwnProperty('is_dttm') && currentCol.is_dttm) {
        allChoices = allChoices.map((choice) =>
          choice.isNotOption
            ? { ...choice }
            : {
                value: moment(choice.value).format(
                  sqlDateFormats[currentCol.type] || sqlDateFormats[dateTypes.DATETIME]
                ),
                label: moment(choice.value).format(
                  dateFormats[currentCol.type] || dateFormats[dateTypes.DATETIME]
                ),
              }
        );
      }

      return (
        <SelectControl
          ref={(ref) => {
            this.filterSelect = ref;
          }}
          multi={operator.multi}
          name='filter-value'
          freeForm
          value={value}
          inputValue={this.state.inputValue}
          isLoading={this.state.valuesLoading}
          choices={allChoices}
          onChange={this.changeSelect}
          onInputChange={this.onInputChange}
          menuRenderer={this.renderMenu}
          selectWrap={Select}
          noResultsText={this.state.noResultsText}
          filterOptions={(options, search) => {
            if (search.length < 3) {
              return options.filter((opt) => !!opt.isNotOption);
            }
            return options.filter(
              (opt) =>
                opt.label
                  .toString()
                  .toLowerCase()
                  .indexOf(search.toLowerCase()) > -1 || !!opt.isNotOption
            );
          }}
        />
      );
    }
    return (
      <input
        type='text'
        onChange={this.changeText}
        value={value}
        className='form-control input-sm'
        placeholder={t('Filter value')}
      />
    );
  }
  render() {
    const datasource = this.props.datasource;
    const filter = this.props.filter;
    const opsChoices = operatorsArr
      .filter((o) => !o.datasourceTypes || o.datasourceTypes.indexOf(datasource.type) >= 0)
      .map((o) => ({ value: o.val, label: o.label || o.val }));
    const verboseValueLabel =
      (datasource.columns.find((item) => item.column_name === filter.col) || {}).verbose_name ||
      filter.col;
    return (
      <div>
        <Row className='space-1'>
          <Col md={12}>
            <Select
              placeholder={t('Column Group')}
              options={Object.keys(this.state.groups || {}).map((k) => ({
                value: k,
                label: this.state.groups[k].label,
              }))}
              value={this.state.selectedGroup}
              onChange={(v) => this.onGroupChange(v)}
            />
            <Select
              id='select-col'
              placeholder={t('Select column')}
              clearable={false}
              options={this.state.colChoices}
              value={{ value: filter.col, label: verboseValueLabel }}
              onChange={this.changeColumn}
            />
          </Col>
        </Row>
        <Row className='space-1'>
          <Col md={3}>
            <Select
              id='select-op'
              placeholder={t('Select operator')}
              options={opsChoices}
              clearable={false}
              value={filter.op}
              onChange={this.changeOp}
            />
          </Col>
          <Col md={7}>{this.renderFilterFormControl(filter)}</Col>
          <Col md={2}>
            <Button id='remove-button' bsSize='small' onClick={this.removeFilter}>
              <i className='fa fa-minus' />
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

FilterWithGroup.propTypes = propTypes;
FilterWithGroup.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    chartData: state.charts,
  };
}

export default connect(mapStateToProps)(FilterWithGroup);
