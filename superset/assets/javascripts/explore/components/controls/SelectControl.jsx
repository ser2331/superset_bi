import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import Select, { Creatable } from 'react-select';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';

const propTypes = {
  clearable: PropTypes.bool,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  multi: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  valueRenderer: PropTypes.func,
  valueKey: PropTypes.string,
  options: PropTypes.array,
  choices: PropTypes.array,
  placeholder: PropTypes.string,
  filterOptions: PropTypes.func,
};

const defaultProps = {
  options: [],
  clearable: true,
  description: null,
  disabled: false,
  freeForm: false,
  isLoading: false,
  label: null,
  multi: false,
  onChange: () => {},
  onFocus: () => {},
  showHeader: true,
  optionRenderer: opt => opt.label,
  valueRenderer: opt => opt.label,
  valueKey: 'value',
  filterOptions: undefined,
};

export default class SelectControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { options: this.getOptions(props) };
    this.onChange = this.onChange.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    if ((nextProps.options !== this.props.options) || (nextProps.choices !== this.props.choices)) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }
  onChange(opt) {
    let optionValue = opt ? opt[this.props.valueKey] : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map(o => o[this.props.valueKey]) : null;
    }
    this.props.onChange(optionValue);
  }
  getOptions(props) {
    const { choices, options, freeForm, translateLabels } = props;
    // Accepts different formats of input
    const resultOptions = (choices || options).map((c) => {
      let option;
      if (Array.isArray(c)) {
        const label = c.length > 1 ? c[1] : c[0];
        option = {
          value: c[0],
          label,
        };
      } else if (typeof c === 'object') {
        option = c;
      } else {
        option = {
          value: c,
          label: c,
        };
      }
      if (translateLabels) {
        option.label = t(option.label);
      }
      return option;
    });
    if (freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = resultOptions.map(c => c.value);
      if (props.value) {
        let valuesToAdd = props.value;
        if (!Array.isArray(valuesToAdd)) {
          valuesToAdd = [valuesToAdd];
        }
        valuesToAdd.forEach((v) => {
          if (values.indexOf(v) < 0) {
            resultOptions.push({ value: v, label: v });
          }
        });
      }
    }
    return resultOptions;
  }
  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const placeholder = this.props.placeholder || t('%s option(s)', this.state.options.length);
    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      placeholder,
      options: this.state.options,
      value: this.props.value,
      labelKey: 'label',
      valueKey: this.props.valueKey,
      autosize: false,
      clearable: this.props.clearable,
      isLoading: this.props.isLoading,
      onChange: this.onChange,
      onFocus: this.props.onFocus,
      optionRenderer: VirtualizedRendererWrap(this.props.optionRenderer),
      valueRenderer: this.props.valueRenderer,
      filterOptions: this.props.filterOptions,
      selectComponent: this.props.freeForm ? Creatable : Select,
      disabled: this.props.disabled,
      noResultsText: t('No results found'),
    };
    return (
      <div>
        {this.props.showHeader &&
          <ControlHeader {...this.props} />
        }
        <OnPasteSelect {...selectProps} selectWrap={VirtualizedSelect} />
      </div>
    );
  }
}

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
