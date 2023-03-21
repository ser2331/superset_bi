import React, { PropTypes } from 'react';
import { Button, Row, Col } from 'react-bootstrap';
import Select from 'react-select';
import { t } from '../../../locales';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.object,
};

const defaultProps = {
  onChange: () => { },
  value: [],
};

const targetType = [
  { value: 'dashboards', label: t('Dashboard') },
  { value: 'slices', label: t('Slice') },
];

export default class URLDrilldownControl extends React.Component {

  onChangeType(index, type) {
    if (type && this.props.value[index].type !== type.value) {
      this.props.value[index].url = null;
      this.setState({
        availableObjects: this.props[type.value].map(o => ({ label: o.name, value: o.id }))
      });
    }

    this.changeDrilldown(index, 'type', type);
  }

  addDrilldown() {
    const newFields = Object.assign([], this.props.value);
    newFields.push({
      title: '',
      field: '',
      type: '',
      url: '',
    });
    this.props.onChange(newFields);
  }

  changeDrilldown(index, control, value) {
    const newFields = Object.assign([], this.props.value);
    const modifiedDrilldown = Object.assign({}, newFields[index]);
    if (typeof control === 'string') {
      if (typeof value === 'object') {
        modifiedDrilldown[control] = value ? value.value : null;
      } else {
        modifiedDrilldown[control] = value;
      }
    } else {
      control.forEach((c, i) => {
        modifiedDrilldown[c] = value[i];
      });
    }
    newFields.splice(index, 1, modifiedDrilldown);
    this.props.onChange(newFields);
  }

  removeDrilldown(index) {
    this.props.onChange(this.props.value.filter((f, i) => i !== index));
  }

  render() {
    const drilldowns = this.props.value.map((drilldown, i) => (
      <div key={i}>
        <div className="form-group form-group-sm">
          <input
            placeholder={t('Title')}
            className="form-control"
            type="text"
            value={drilldown.title}
            onChange={el => this.changeDrilldown(i, 'title', el.target.value)}
          />
          <Select
            placeholder={t('Metric')}
            options={this.props.datasource.metrics_combo.map(c => ({ value: c[0], label: c[1] }))}
            value={drilldown.field}
            onChange={val => this.changeDrilldown(i, 'field', val)}
          />
          <Select
            placeholder={t('Type')}
            options={targetType}
            value={drilldown.type}
            onChange={val => this.onChangeType(i, val)}
          />
          <Select
            placeholder={t('Object')}
            options={this.props[drilldown.type] ? this.props[drilldown.type].map(o => ({ label: o.name, value: o.id })) : []}
            value={drilldown.url}
            onChange={val => this.changeDrilldown(i, 'url', val)}
          />
          <Button
            id="remove-button"
            bsSize="small"
            onClick={this.removeDrilldown.bind(this, i)}
          >
            <i className="fa fa-minus" />
          </Button>
        </div>
      </div>
    ));
    return (
      <div>
        <div className="pull-left">
          <label className="control-label">
            <span>{t('URL Drilldown')}</span>
          </label>
        </div>
        {drilldowns}
        <Row className="space-2">
          <Col md={2}>
            <Button
              id="add-button"
              bsSize="sm"
              onClick={this.addDrilldown.bind(this)}
            >
              <i className="fa fa-plus" /> &nbsp; {t('Add Drilldown URL')}
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

URLDrilldownControl.propTypes = propTypes;
URLDrilldownControl.defaultProps = defaultProps;
