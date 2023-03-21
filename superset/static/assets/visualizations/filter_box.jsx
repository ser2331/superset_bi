// JS
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import VirtualizedSelect from 'react-virtualized-select';
import { Creatable } from 'react-select';
import { Button, Alert } from 'react-bootstrap';
import moment from 'moment';
import _ from 'lodash';

import DateFilterControl from '../javascripts/explore/components/controls/DateFilterControl';
import ControlRow from '../javascripts/explore/components/ControlRow';
import Control from '../javascripts/explore/components/Control';
import controls from '../javascripts/explore/stores/controls';
import OnPasteSelect from '../javascripts/components/OnPasteSelect';
import VirtualizedRendererWrap from '../javascripts/components/VirtualizedRendererWrap';
import './filter_box.css';
import { t } from '../javascripts/locales';
import { dehumanizeDate } from '../javascripts/utils/common';
import { dateFormats, dateTypes, sqlDateFormats } from '../constants/common';

const $ = window.$ = require('jquery');

// maps control names to their key in extra_filters
const timeFilterMap = {
  since: '__from',
  until: '__to',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};
const propTypes = {
  origSelectedValues: PropTypes.object,
  instantFiltering: PropTypes.bool,
  filtersChoices: PropTypes.object,
  onChange: PropTypes.func,
  showDateFilter: PropTypes.bool,
  showSqlaTimeGrain: PropTypes.bool,
  showSqlaTimeColumn: PropTypes.bool,
  showDruidTimeGrain: PropTypes.bool,
  showDruidTimeOrigin: PropTypes.bool,
  datasource: PropTypes.object.isRequired,
  dashboardId: PropTypes.number,
  userName: PropTypes.string,
};
const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  showDateFilter: false,
  showSqlaTimeGrain: false,
  showSqlaTimeColumn: false,
  showDruidTimeGrain: false,
  showDruidTimeOrigin: false,
  instantFiltering: true,
};

const getUrl = dashboardId => `/superset/dashboard/${dashboardId}/filter_settings/`;
const since = '__from';
const until = '__to';

class FilterBox extends React.Component {
  constructor(props) {
    super(props);
    const selectedValues = Array.isArray(props.origSelectedValues)
      ? props.origSelectedValues.reduce((acc, v) => { acc[v.col] = v.val; return acc; }, {})
      : props.origSelectedValues;
    this.state = {
      selectedValues,
      hasChanged: false,
      isSaved: false,
    };

    this.renderChangedValues = this.renderChangedValues.bind(this);
  }

  componentDidMount() {
    this.getFilters();
  }

  getFilters() {
    $.ajax({
      type: 'GET',
      url: getUrl(this.props.dashboardId),
      success: (res) => {
        this.setState({
          selectedValues: {
            ...this.state.selectedValues,
            ...res,
          },
        }, () => {
          this.applyFilters();
        });
      },
    });
  }

  getControlData(controlName) {
    const control = Object.assign({}, controls[controlName]);
    const controlData = {
      name: controlName,
      key: `control-${controlName}`,
      value: this.state.selectedValues[timeFilterMap[controlName]],
      actions: { setControlValue: this.changeFilter.bind(this) },
    };
    Object.assign(control, controlData);
    const mapFunc = control.mapStateToProps;
    if (mapFunc) {
      return Object.assign({}, control, mapFunc(this.props));
    }
    return control;
  }

  clickApply() {
    this.applyFilters();
  }

  changeFilter(filter, options) {
    const fltr = timeFilterMap[filter] || filter;
    let vals = null;
    if (options !== null) {
      if (Array.isArray(options)) {
        vals = options.map(opt => opt.value);
      } else if (options.value) {
        vals = options.value;
      } else {
        vals = options;
      }
    }
    // фильтруем и удаляем isCreated опции если их нет в vals
    if (this.props.filtersChoices[filter]) {
      this.props.filtersChoices[filter] = this.props.filtersChoices[filter].filter(opt => {
        if (opt.isCreated && vals.indexOf(opt.id)) {
          return false;
        }
        return true;
      })
    }

    const selectedValues = Object.assign({}, this.state.selectedValues);
    selectedValues[fltr] = vals;
    this.setState({ selectedValues, hasChanged: true, isSaved: false });
    if (this.props.instantFiltering) {
      this.props.onChange(fltr, vals, false, true);
    }
  }

  saveFilters() {
    const filters = { ...this.state.selectedValues };

    for (const key in filters) {
      const filter = filters[key];
      if (!filter) {
        delete filters[key];
      }
    }

    $.ajax({
      type: 'POST',
      url: getUrl(this.props.dashboardId),
      data: {
        data: JSON.stringify(filters),
      },
      success: () => this.setState({ isSaved: true }),
    });
  }

  applyFilters() {
    const { selectedValues } = this.state;
    Object.keys(selectedValues).forEach((fltr, i, arr) => {
      let refresh = false;
      if (i === arr.length - 1) {
        refresh = true;
      }
      this.props.onChange(fltr, selectedValues[fltr], false, refresh);
    });
  }

  renderChangedValues() {
    const values = { ...this.state.selectedValues };
    const result = [];

    for (let key in values) {
      const filter = values[key];
      let value;

      if (Array.isArray(filter) && filter.length) {
        value = filter.join(', ');
      } else if (filter.options) {
        value = filter.options;
      } else if (key === since || key === until) {
          if (filter) {
            if (moment(filter).isValid()) {
              value = moment(filter).format('YYYY-MM-DD HH:mm:ss');
            } else {
              value = dehumanizeDate(filter);
            }
          } else {
            value = '∞';
          }
        } else {
          value = filter;
        }

      if (key === since) {
        key = t('Since');
      } else if (key === until) {
        key = t('Until');
      } else {
        key = this.props.datasource.verbose_map[key];
      }

      result.push(<li><strong>{key}</strong>: {t(value)}</li>);
    }
    return result;
  }


  render() {
    const { selectedValues, hasChanged, isSaved } = this.state;

    let dateFilter;
    if (this.props.showDateFilter) {
      dateFilter = (
        <div className="row space-1">
          <div className="col-lg-6 col-xs-6">
            <DateFilterControl
              name={since}
              label={t('Since')}
              description={t('Select starting date')}
              onChange={this.changeFilter.bind(this, since)}
              value={selectedValues[since]}
            />
          </div>
          <div className="col-lg-6 col-xs-6">
            <DateFilterControl
              name={until}
              label={t('Until')}
              description={t('Select end date')}
              onChange={this.changeFilter.bind(this, until)}
              value={selectedValues[until]}
            />
          </div>
        </div>
      );
    }
    const datasourceFilters = [];
    const sqlaFilters = [];
    const druidFilters = [];
    if (this.props.showSqlaTimeGrain) sqlaFilters.push('time_grain_sqla');
    if (this.props.showSqlaTimeColumn) sqlaFilters.push('granularity_sqla');
    if (this.props.showDruidTimeGrain) druidFilters.push('granularity');
    if (this.props.showDruidTimeOrigin) druidFilters.push('druid_time_origin');
    if (sqlaFilters.length) {
      datasourceFilters.push(
        <ControlRow
          key="sqla-filters"
          className="control-row"
          controls={sqlaFilters.map(control => (
            <Control {...this.getControlData(control)} />
          ))}
        />,
      );
    }
    if (druidFilters.length) {
      datasourceFilters.push(
        <ControlRow
          key="druid-filters"
          className="control-row"
          controls={druidFilters.map(control => (
            <Control {...this.getControlData(control)} />
          ))}
        />,
      );
    }
    // Add created options to filtersChoices, even though it doesn't exist,
    // or these options will exist in query sql but invisible to end user.
    for (const filterKey in selectedValues) {
      if (
        !selectedValues.hasOwnProperty(filterKey) ||
        !(filterKey in this.props.filtersChoices)
      ) {
        continue;
      }
      const existValues = this.props.filtersChoices[filterKey].map(f => f.id);
      for (const v of selectedValues[filterKey]) {
        if (existValues.indexOf(v) === -1) {
          const addChoice = {
            filter: filterKey,
            id: v,
            text: v,
            metric: 0,
            isCreated: true,
          };
          this.props.filtersChoices[filterKey].unshift(addChoice);
        }
      }
    }
    const filters = Object.keys(this.props.filtersChoices).map((filter) => {
      const data = this.props.filtersChoices[filter];
      const currentCol = _.find(this.props.datasource.columns, ['column_name', filter]);

      const tsFormat = dateFormats[currentCol.type] || dateFormats[dateTypes.DATETIME];
      const sqlFormat = sqlDateFormats[currentCol.type] || sqlDateFormats[dateTypes.DATETIME];

      const maxes = {};
      maxes[filter] = d3.max(data, function (d) {
        return d.metric;
      });
      return (
        <div key={filter} className="m-b-5">
          {this.props.datasource.verbose_map[filter] || filter}
          <OnPasteSelect
            placeholder={t('Select [%s]', this.props.datasource.verbose_map[filter] || filter)}
            key={filter}
            multi
            useOnlyExistingOnPaste
            value={selectedValues[filter]}
            options={data.map((opt) => {
              const perc = Math.round((opt.metric / maxes[opt.filter]) * 100);
              const backgroundImage = (
                'linear-gradient(to right, lightgrey, ' +
                `lightgrey ${perc}%, rgba(0,0,0,0) ${perc}%`
              );
              const style = {
                backgroundImage,
                padding: '2px 5px',
              };

              if (currentCol.is_dttm) {
                const formattedValue = moment(opt.id).format(sqlFormat);
                const formattedLabel = moment(opt.id).format(tsFormat);
                return { ...opt, value: formattedValue, label: formattedLabel, style };
              }

              return { ...opt, value: opt.id, label: opt.id, style };
            })
            }
            onChange={this.changeFilter.bind(this, filter)}
            selectComponent={Creatable}
            selectWrap={VirtualizedSelect}
            optionRenderer={VirtualizedRendererWrap(opt => opt.label)}
            filterOptions={(options, search) => {
              if (search.length < 3) {
                return [{
                  value: '',
                  label: t('Enter 3 characters to start the search'),
                  onClick: () => {},
                  disabled: true,
                }];
              }
              return options.filter(opt => opt.label.toString().toLowerCase().indexOf(search.toLowerCase()) > -1);
            }}
            promptTextCreator={value => t('Create option %s', value)}
          />
        </div>
      );
    });
    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {
            isSaved &&
            <div>
              <Alert bsStyle="success">
                <div>Настройки сохранены:</div>
                <ul>
                  {this.renderChangedValues()}
                </ul>
                для <strong>{this.props.userName}</strong>
              </Alert>
            </div>
          }
          {dateFilter}
          {datasourceFilters}
          {filters}
          <div className="align-button-container">
            <div>
              {!this.props.instantFiltering &&
              <Button
                bsSize="small"
                bsStyle="primary"
                onClick={this.clickApply.bind(this)}
                disabled={!hasChanged}
              >
                {t('Apply')}
              </Button>
              }
            </div>

            <div>
              <Button
                bsSize="small"
                onClick={this.saveFilters.bind(this)}
                disabled={!hasChanged}
              >
                <i className="fa fa-plus-circle" /> {t('Save')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

function filterBox(slice, payload) {
  const d3token = d3.select(slice.selector);
  d3token.selectAll('*').remove();

  // filter box should ignore the dashboard's filters
  // const url = slice.jsonEndpoint({ extraFilters: false });
  const fd = slice.formData;
  const filtersChoices = {};
  // Making sure the ordering of the fields matches the setting in the
  // dropdown as it may have been shuffled while serialized to json
  fd.groupby.forEach((f) => {
    filtersChoices[f] = payload.data[f];
  });
  ReactDOM.render(
    <FilterBox
      filtersChoices={filtersChoices}
      onChange={slice.addFilter}
      showDateFilter={fd.date_filter}
      showSqlaTimeGrain={fd.show_sqla_time_granularity}
      showSqlaTimeColumn={fd.show_sqla_time_column}
      showDruidTimeGrain={fd.show_druid_time_granularity}
      showDruidTimeOrigin={fd.show_druid_time_origin}
      datasource={slice.datasource}
      origSelectedValues={slice.getFilters() || {}}
      instantFiltering={fd.instant_filtering}
      dashboardId={slice.props.dashboardId}
      userName={slice.props.userName}
    />,
    document.getElementById(slice.containerId),
  );
}

export default filterBox;
