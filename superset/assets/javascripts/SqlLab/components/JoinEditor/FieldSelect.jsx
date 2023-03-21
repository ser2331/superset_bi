import React from 'react';
import { Dropdown, MenuItem } from 'react-bootstrap';

import './FieldSelect.less';
import { t } from '../../../locales';

class FieldSelect extends React.Component {
  render() {
    return (
      <Dropdown
        id={this.props.label}
        className="field-select-container"
        onSelect={this.props.onChange}
      >
        <Dropdown.Toggle className="field-select">
          <div className="table-select__value" title={this.props.value}>
              {this.props.value}
          </div>
        </Dropdown.Toggle>
        <Dropdown.Menu className="field-select__menu">
          { this.props.fields.map(field => (
            <MenuItem key={field.name} eventKey={field.name}>
              {field.name}
            </MenuItem>
          ))}
          { !this.props.fields.length &&
            <MenuItem disabled key="No options" active={false}>
              {t('No options')}
            </MenuItem>
          }
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default FieldSelect;
