import React from 'react';
import { Dropdown, MenuItem } from 'react-bootstrap';

import './TableSelect.less';
import { t } from '../../../locales';

class TableSelect extends React.Component {

  constructor(props) {
    super(props);
    this.handleSelect = this.handleSelect.bind(this);  
  }

  handleSelect(eventKey) {
    const value = this.props.tables.find(table => table.id === eventKey);
    this.props.onSelect(value);
  }

  render() {
    const { label, value, tables } = this.props;
    const tableName = value && value.name ? `${value.name}${value.alias && ` as ${value.alias}`}` : '';
    return (
      <Dropdown id={label} onSelect={this.handleSelect}>
        <Dropdown.Toggle className="table-select">
          <div className="table-select__labels">
            <div className="table-select__label">
              {label}
            </div>
            <div className="table-select__value" title={tableName}>
              {tableName}
            </div>
          </div>
        </Dropdown.Toggle>
        <Dropdown.Menu className="table-select__menu">
          { tables && tables.map((table, index) => (
            <MenuItem key={index} eventKey={table.id}>
              {table.name}
              {table.alias && ` as ${table.alias}`}
            </MenuItem>
          ))}
          { (!tables || (tables && !tables.length)) &&
            <MenuItem disabled active={false}>
              {t('No options')}
            </MenuItem>
          }
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default TableSelect;
