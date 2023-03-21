import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import AdhocMetric from '../explore/AdhocMetric';

export default class OnPasteSelect extends React.Component {
  onPaste(evt) {
    if (!this.props.multi) {
      return;
    }
    evt.preventDefault();
    const clipboard = evt.clipboardData.getData('Text');
    if (!clipboard) {
      return;
    }
    const regex = `${this.props.separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`;
    const values = clipboard.split(new RegExp(regex)).map((v) => {
      const trimmedValue = v.trim();
      if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
        return trimmedValue.slice(1, -1);
      }
      return trimmedValue;
    });
    const validator = this.props.isValidNewOption;
    const selected = this.props.value || [];
    const existingOptions = {};
    const existing = {};
    this.props.options.forEach((v) => {
      existingOptions[v[this.props.valueKey]] = 1;
    });
    let options = [];
    selected.forEach((v) => {
      options.push({ [this.props.labelKey]: v, [this.props.valueKey]: v });
      existing[v] = 1;
    });

    const { valueKey, labelKey } = this.props;

    if (this.props.useOnlyExistingOnPaste) {
      const pastedOptions = values
        .map((v) => {
          const option = this.props.options.find(
            o =>
              o[labelKey] === v ||
              o[valueKey] === v ||
              o.column_name === v ||
              o.verbose_name === v ||
              o.metric_name === v,
          );
          if (option) {
            return option;
          }
          return null;
        })
        .filter(Boolean)
        .filter(
          option =>
            !selected.find((s) => {
              if (s instanceof AdhocMetric) {
                return (
                  s.column[labelKey] === option[valueKey] ||
                  s.column[valueKey] === option[valueKey] ||
                  s.column.column_name === option[valueKey] ||
                  s.column.verbose_name === option[valueKey] ||
                  s.column.metric_name === option[valueKey]
                );
              }
              return (s[valueKey] || s) === option[valueKey];
            }),
        );

      const selectedOptions = selected
        .map((s) => {
          if (s instanceof AdhocMetric) {
            return s;
          }
          if (typeof s === 'object') {
            return this.props.options.find(o => o[valueKey] === s[valueKey]);
          }
          if (typeof s === 'string') {
            return this.props.options.find(
              o =>
                o[labelKey] === s ||
                o[valueKey] === s ||
                o.column_name === s ||
                o.verbose_name === s ||
                o.metric_name === s,
            );
          }
          return null;
        })
        .filter(Boolean);

      if (pastedOptions.length) {
        this.props.onChange(selectedOptions.concat(pastedOptions));
      }

      return;
    }

    options = options.concat(
      values
        .filter((v) => {
          const notExists = !existing[v];
          existing[v] = 1;
          return (
            notExists &&
            (validator ? validator({ [this.props.labelKey]: v }) : !!v)
          );
        })
        .map((v) => {
          const opt = { [this.props.labelKey]: v, [this.props.valueKey]: v };
          if (!existingOptions[v]) {
            this.props.options.unshift(opt);
          }
          return opt;
        }),
    );
    if (options.length) {
      if (this.props.onChange) {
        this.props.onChange(options);
      }
    }
  }
  render() {
    const SelectComponent = this.props.selectWrap;
    const refFunc = (ref) => {
      if (this.props.refFunc) {
        this.props.refFunc(ref);
      }
      this.pasteInput = ref;
    };
    const inputProps = { onPaste: this.onPaste.bind(this) };
    return (
      <SelectComponent {...this.props} ref={refFunc} inputProps={inputProps} />
    );
  }
}

OnPasteSelect.propTypes = {
  separator: PropTypes.string.isRequired,
  selectWrap: PropTypes.func.isRequired,
  refFunc: PropTypes.func,
  onChange: PropTypes.func.isRequired,
  valueKey: PropTypes.string.isRequired,
  labelKey: PropTypes.string.isRequired,
  options: PropTypes.array,
  multi: PropTypes.bool.isRequired,
  value: PropTypes.any,
  isValidNewOption: PropTypes.func,
};
OnPasteSelect.defaultProps = {
  separator: ',',
  selectWrap: Select,
  valueKey: 'value',
  labelKey: 'label',
  options: [],
  multi: false,
};
