import React, { PropTypes } from 'react';
import Select, { Creatable } from 'react-select';
import { isEqual } from 'underscore';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

const propTypes = {
  options: PropTypes.array,
  groups: PropTypes.object,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  multi: PropTypes.bool,
  name: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
};

const defaultProps = {
  options: [],
  groups: {},
  clearable: true,
  description: null,
  freeForm: false,
  isLoading: false,
  label: null,
  multi: false,
  showHeader: true,
  onChange: () => {},
};

const componentName = 'SelectWithGroupControl';

export default class SelectWithGroupControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
        availableOptions: this.getOptions(props),
        options: this.getOptions(props),
    };
    this.onChange = this.onChange.bind(this);
    this.renderOption = this.renderOption.bind(this);
    this.onGroupChange = this.onGroupChange.bind(this);
  }

  componentWillReceiveProps(nextProps) {
      if (this.props.options !== nextProps.options) {
          this.setState({
              availableOptions: this.getOptions(nextProps),
              options: this.getOptions(nextProps),
          });
      }
  }

  shouldComponentUpdate(nextProps, nextState) {
      const allPropsMatched = Object.keys(nextProps)
          .filter(key => key !== 'hovered')
          .every(key => nextProps[key] === this.props[key]);
      if (!isEqual(this.state, nextState)) {
        return true;
      }
      return !allPropsMatched;
  }

  onGroupChange(opt) {
    let options = this.getOptions(this.props);
    if (opt) {
      options = options.filter(item => this.props.groups[opt.value].columns.includes(item.value));
    }
    this.setState({ options, selectedGroup: opt });
  }
  onChange(opt) {
    let optionValue = opt ? opt.value : null;
    // if multi, return options values as an array
    if (this.props.multi) {
      optionValue = opt ? opt.map(o => o.value) : null;
    }
    this.props.onChange(optionValue);
  }
  getOptions(props) {
    // Accepts different formats of input
    const options = props.options.map((c) => {
      let option;
      if (Array.isArray(c)) {
        const label = c.length > 1 ? c[1] : c[0];
        option = {
          value: c[0],
          label,
        };
        if (c[2]) option.imgSrc = c[2];
      } else if (typeof c !== 'object') {
        option = {
          value: c,
          label: c,
        };
      } else {
        option = { ...c, value: c.column_name, label: c.verbose_name || c.column_name };
      }
      return option;
    });
    if (props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = options.map(c => c.value);
      if (props.value) {
        let valuesToAdd = props.value;
        if (!Array.isArray(valuesToAdd)) {
          valuesToAdd = [valuesToAdd];
        }
        valuesToAdd.forEach((v) => {
          if (values.indexOf(v) < 0) {
            options.push({ value: v, label: v });
          }
        });
      }
    }
    return options;
  }
  renderOption(opt) {
    if (opt.imgSrc) {
      return (
        <div>
          <img className="viz-thumb-option" src={opt.imgSrc} alt={opt.value} />
          <span>{opt.label}</span>
        </div>
      );
    }
    return opt.label;
  }
  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const value = Array.isArray(this.props.value)
        ? this.props.value.map((item) => {
            return this.state.availableOptions.find((option) => {
                if (typeof option === 'object') {
                      return option.column_name === item;
                }
              return option === item;
            });
        })
        : this.props.value;
    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      options: this.state.options,
      placeholder: t('%s option(s)', this.state.options.length),
      value,
      autosize: false,
      clearable: this.props.clearable,
      isLoading: this.props.isLoading,
      onChange: this.onChange,
      optionRenderer: this.props.optionRenderer || this.renderOption,
      valueRenderer: this.props.valueRenderer || (v => v),
      noResultsText: t('No results found'),
      sortableGroup: componentName,
      sortableValues: true,
    };
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const selectWrap = this.props.freeForm ?
      (<Creatable {...selectProps} />) : (<Select {...selectProps} />);
    return (
      <div>
        { this.props.showHeader &&
          <ControlHeader {...this.props} />
        }
        <Select
          placeholder={t('Column Group')}
          options={Object.keys(this.props.groups).map(k => ({ value: k, label: this.props.groups[k].label }))}
          value={this.state.selectedGroup}
          onChange={this.onGroupChange}
          noResultsText={t('No results found')}
        />
        {selectWrap}
      </div>
    );
  }
}

SelectWithGroupControl.propTypes = propTypes;
SelectWithGroupControl.defaultProps = defaultProps;
