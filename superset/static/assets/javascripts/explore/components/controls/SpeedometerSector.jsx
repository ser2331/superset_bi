import React, { PropTypes } from 'react';
import { Button } from 'react-bootstrap';
import TextControl from './TextControl';
import './FilterNode.css';
import { t } from '../../../locales';
import ControlHeader from '../ControlHeader';
import ColorPickerControl from './ColorPickerControl';
import CheckboxControl from './CheckboxControl';
export class SpeedometerSector extends React.Component {
    constructor(props) {
        super(props);
        this.changeSectorValues = this.changeSectorValues.bind(this);
    }

    changeSectorValues(valueField, field) {
        const { id, value, onChange } = this.props;
        onChange(id, Object.assign({}, value, { [field]: valueField }));
    }

    render() {
        const { value, onRemoveSector, leftLabel, errorPositions } = this.props;
        const { description, from, to, labelLeft, labelRight, color, percentageRange } = value || {};
        const hasError = Boolean(errorPositions?.length);
        return (
          <div>
            <div className={`node-card ${hasError ? "error" : ""}`}>
              <TextControl
                className={'form-group'}
                placeholder={t('Description')}
                value={description || ''}
                name={'description'}
                onChange={val => this.changeSectorValues(val, 'description')}
              />
              <div className={'select-from-to-wrap form-group'}>
                <ControlHeader label={t('Select range:')} />
                <TextControl
                   className={`select-from-to ${
                    errorPositions?.includes("from") ? "error" : ""
                  }`}
                  name={'from'}
                  placeholder={t('From')}
                  value={from}
                  onChange={val => this.changeSectorValues(val ? val.replace(/[^-.0-9]/gm, '').replace(/\./,'$$$$$').replace(/\./g,'').replace('$$$', '.') : '', 'from')}
                />
                <TextControl
                   className={`select-from-to ${
                    errorPositions?.includes("to") ? "error" : ""
                  }`}
                  name={'to'}
                  placeholder={t('To')}
                  value={to}
                  onChange={val => this.changeSectorValues(val ? val.replace(/[^-.0-9]/gm, '').replace(/\./,'$$$$$').replace(/\./g,'').replace('$$$', '.') : '', 'to')}
                />
              </div>
              <div className={'select-from-to-wrap form-group'}>
                <ControlHeader label={t('Select label')} />
                {leftLabel && <TextControl
                  placeholder={t('Label left')}
                  className={'select-from-to'}
                  value={labelLeft || ''}
                  name={'labelLeft'}
                  onChange={val => this.changeSectorValues(val.substr(0, 255), 'labelLeft')}
                />
                        }
                <TextControl
                  placeholder={t('Label right')}
                  className={leftLabel ? 'select-from-to' : 'fullwidth'}
                  value={labelRight || ''}
                  name={'labelRight'}
                  onChange={val => this.changeSectorValues(val.substr(0, 255), 'labelRight')}
                />
                <div className={'flex'}>
                  <ColorPickerControl
                    value={color}
                    name={'color'}
                    label={t('Color')}
                    onChange={val => this.changeSectorValues(val, 'color')}
                  />
                  <Button
                    onClick={onRemoveSector}
                    bsSize="sm"
                  >
                    <i className="fa fa-minus" /> &nbsp; {t('Remove item')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
    }
}


SpeedometerSector.propTypes = {
    value: PropTypes.object,
    onRemoveSector: PropTypes.func,
    onChange: PropTypes.func,
    id: PropTypes.number,
    leftLabel: PropTypes.bool,
};

SpeedometerSector.defaultProps = {
    onChange: () => {
    },
};

export default SpeedometerSector;
