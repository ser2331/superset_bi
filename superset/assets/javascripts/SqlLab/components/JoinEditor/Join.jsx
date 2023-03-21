import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import TableSelect from './TableSelect';
import JoinSelect from './JoinSelect';
import './Join.css';
import { t } from '../../../locales';

const propTypes = {
  primary: PropTypes.bool,
  join: PropTypes.object,
  tables: PropTypes.array,
  aliases: PropTypes.array,
  operations: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

class Join extends React.Component {
  constructor(props) {
    super(props);
    this.handleChangeFrom = this.handleChange.bind(this, 'from');
    this.handleChangeTarget = this.handleChange.bind(this, 'target');
    this.handleChangeOperation = this.handleChange.bind(this, 'operation');
    this.handleDelete = () => props.onDelete(props.join);

  }

  handleChange(prop, value) {
    this.props.onChange({ ...this.props.join, [prop]: value }, prop);
  }

  render() {
    const { primary, tables, aliases, operations, join } = this.props;
    const { from, target } = join;
    return (
      <div className="join-editor-join">
        <div className="join-editor-tables">
          <div className="join-editor-join__table">
            <TableSelect
              label={t('from')}
              tables={primary ? tables : aliases}
              value={from}
              onSelect={this.handleChangeFrom}
            />
          </div>
          <div className="join-editor-join__operations">
            <JoinSelect
              operations={operations}
              join={join}
              onChange={this.props.onChange}
            />
          </div>
          <div className="join-editor-join__table">
            <TableSelect
              label={t('target')}
              tables={[...tables, ...aliases]}
              value={target}
              onSelect={this.handleChangeTarget}
            />
          </div>
          <div >
            <Button
              bsSize="large"
              className="join-editor-join__remove"
              onClick={this.handleDelete}
            >
              <i className="fa fa-trash" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
Join.propTypes = propTypes;

export default Join;
