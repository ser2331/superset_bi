import React from 'react';
import * as shortid from 'shortid';
import { Button, Popover, OverlayTrigger, Tooltip, Overlay } from 'react-bootstrap';
import FieldSelect from './FieldSelect';

import './JoinSelect.less';
import { t } from '../../../locales';

function toDashStyle(string) {
  return string.toLowerCase().replace(/\s/g, '-');
}

class JoinSelect extends React.Component {

  constructor(props) {
    super(props);
    this.handleChangeFieldLeft = (column, fieldId) => this.handleChangeField('leftValue', column, fieldId);
    this.handleChangeFieldRight = (column, fieldId) => this.handleChangeField('rightValue', column, fieldId);
    this.handleAddField = this.handleAddField.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleOpen = () => this.handleToggle(true);
    this.handleClose = () => this.handleToggle(false);
    this.state = {
      join: props.join,
      popup: false,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.join !== this.props.join) {
      this.setState({ join: nextProps.join });
    }
  }

  getJoinErrors() {
    const { from, target, fields } = this.state.join;
    const errors = { from: '', target: '' };
    if (!from) {
      errors.from = 'Не указана левая витрина';
    }
    if (!target) {
      errors.target = 'Не указана правая витрина';
    }
    if (!from || !target) {
      return errors;
    }
    const field = fields.find(item =>
      from.alias === item.leftTable &&
      target.alias === item.rightTable
    ) || fields[0];
    if (!field.leftValue) {
      errors.from = 'Не указано поле для связи';
    }
    if (!field.rightValue) {
      errors.target = 'Не указано поле для связи';
    }
    return errors;
  }

  handleToggle(isOpen) {
    this.setState({ popup: isOpen });
    if (!isOpen) {
      this.handleSave();
    }
  }

  handleChangeField(type, column, fieldId) {
    this.setState({
      join: {
        ...this.state.join,
        fields: this.state.join.fields.map(field => field.id === fieldId
          ? { ...field, [type]: column }
          : field,
        ),
      },
    });
  }

  handleChangeOperation(operation) {
    this.setState({
      join: { ...this.state.join, operation },
    });
  }

  handleAddField() {
    this.setState({
      join: {
        ...this.state.join,
        fields: [
          ...this.state.join.fields,
          {
            id: shortid.generate(),
            leftTable: this.state.join.from.alias,
            leftValue: '',
            rightTable: this.state.join.target.alias,
            rightValue: '',
          },
        ],
      },
    });
  }

  handleRemoveField(id, index) {
    if (index === 0) { // at least one field needed for sql parser
      return;
    }
    this.setState({
      join: { ...this.state.join, fields: this.state.join.fields.filter(field => field.id !== id) },
    });
  }

  handleSave() {
    this.props.onChange(this.state.join);
  }

  render() {
    const join = this.state.join;
    const { operations } = this.props;
    const { from, target, operation } = join;
    const title = (
      <ul className="join-select__operations">
        { operations.map(item => (
          <li className="join-select__operation" key={item}>
            <button
              className="join-select__operation-button"
              onClick={() => this.handleChangeOperation(item)}
            >
              <div className={`join-select__icon join-select__icon_${toDashStyle(item)}`} />
              <label className="join-select__operation-label">
                {item}
              </label>
            </button>
          </li>
        ))}
      </ul>
    );

    const popover = (
      <Popover
        title={title}
        id="join-select__popover"
        className="join-select__popover"
      >
        <ul className="join-editor-fields">
          { join.fields.map((field, index) => (
            <li key={field.id} className="join-editor-field">
              <FieldSelect
                label="fieldFrom"
                fields={from ? from.columns : []}
                value={field.leftValue}
                onChange={column => this.handleChangeFieldLeft(column, field.id)}
              />
              <div className="join-editor-field__operation">
                =
              </div>
              <FieldSelect
                label="fieldTarget"
                fields={target ? target.columns : []}
                value={field.rightValue}
                onChange={column => this.handleChangeFieldRight(column, field.id)}
              />
              <div
                className={`join-editor-field__remove${index === 0 ? ' join-editor-field__remove_hidden' : ''}`}
                onClick={() => this.handleRemoveField(field.id, index)}
              >
                <i className="fa fa-times" />
              </div>
            </li>
          ))}
          <li className="join-editor-field__new">
            <Button
              onClick={this.handleAddField}
            >
              {t('Add new field clause')}
            </Button>
          </li>
        </ul>
        <Button
          bsStyle="primary"
          className="join-select__ok"
          onClick={this.handleClose}
        >
          {t('ОК')}
        </Button>
      </Popover>
    );
    const fieldEditorDisabled = !this.state.join.from || !this.state.join.target;
    const errors = this.getJoinErrors();
    const errorsFrom = errors.from && <Tooltip id="fromErrors">{errors.from}</Tooltip>;
    const errorsTarget = errors.target && <Tooltip id="targetErrors">{errors.target}</Tooltip>;
    return (
      <div className="join-select">
        <OverlayTrigger overlay={errorsFrom} placement="top" id="error-left">
          <hr className={`join-select__line ${errors.from ? 'join-select__line_error' : ''}`} />
        </OverlayTrigger>
        <button
          ref={(button) => {
            this.target = button;
          }}
          className={`join-select__icon join-select__icon_${toDashStyle(operation)}`}
          disabled={fieldEditorDisabled}
          onClick={this.handleOpen}
        />
        <Overlay
          show={this.state.popup}
          onHide={this.handleClose}
          placement="bottom"
          container={this}
          target={() => this.target}
        >
          {popover}
        </Overlay>
        <OverlayTrigger overlay={errorsTarget} placement="top" id="error-right">
          <hr className={`join-select__line ${errors.target ? 'join-select__line_error' : ''}`} />
        </OverlayTrigger>
      </div>
    );
  }
}

export default JoinSelect;
