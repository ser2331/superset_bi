import React from 'react';
import PropTypes from 'prop-types';
import ControlHeader from '../ControlHeader';
import './RangeControl.css';

const propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.number,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  value: 0,
};

export default class RangeControl extends React.Component {
  min = 0;
  max = 100;
  step = 1;

  onChange(e) {
    this.props.onChange(+e.target.value);
  }

  render() {
    for (let e of document.querySelectorAll(`input[type="range"].${this.props.name}`)) {
      e.style.setProperty('--value', e.value);
      e.style.setProperty('--min', e.min == '' ? '0' : e.min);
      e.style.setProperty('--max', e.max == '' ? '100' : e.max);
      e.addEventListener('input', () =>
        e.style.setProperty('--value', e.value)
      );
    }
    const value = this.props.percent ? `${this.props.value}%` : this.props.value;
    const minValue = this.props.percent ?`${this.props.min || this.min}%`:`${this.props.min || this.min}`;
    const maxValue = this.props.percent ?`${this.props.max || this.max}%`:`${this.props.max || this.max}`;
    return (
      <div>
        <ControlHeader {...this.props} />
        <div className="range-input">
          <div>
            {value}
          </div>
          <input
            className={`${this.props.name} styled-slider slider-progress`}
            type="range"
            id={this.props.name}
            min={this.props.min || this.min}
            max={this.props.max || this.max}
            value={this.props.value}
            step={this.step}
            onChange={this.onChange.bind(this)}
          />
          <div className="range-input-minmax">
            <div>{minValue}</div>
            <div>{maxValue}</div>
          </div>
        </div>
      </div>
    );
  }
}

RangeControl.propTypes = propTypes;
RangeControl.defaultProps = defaultProps;
