import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import Select from 'react-select';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import { ORDER_SORTING } from '../../constants';
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
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array, PropTypes.object]),
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  onChange: PropTypes.func,
  valueRenderer: PropTypes.func,
  refFunc: PropTypes.func,
  options: PropTypes.array,
  choices: PropTypes.array,
  placeholder: PropTypes.string,
  filterOptions: PropTypes.func,
  selectWrap: PropTypes.oneOfType([PropTypes.element, PropTypes.func]),
  className: PropTypes.string,
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
  showHeader: true,
  optionRenderer: opt => opt.label,
  selectWrap: VirtualizedSelect,
  className: '',
};

export default class SelectOrderControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.valueRenderer = this.valueRenderer.bind(this);
    this.changeSortOrder = this.changeSortOrder.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    const { value, options } = nextProps;
    const optionsValue = options.map(o => o.value[0]);
    if (Array.isArray(value) && !value.every(v => optionsValue.includes(v[0]))) {
      this.onChange(value.filter(v => optionsValue.includes(v[0])).map(v => ({ value: v })));
    }
  }
  onChange(opt) {
    let optionValue = opt ? opt.value : null;
    if (this.props.multi) {
      optionValue = opt ? opt.map(o => Array.isArray(o) ? o : o.value) : null;
    }
    this.props.onChange(optionValue);
  }
  changeSortOrder(column) {
    const value = this.props.value;
    const newValue = this.props.multi ? value.map((v) => {
      const [c, s] = v;
      if (c === column) {
        return [c, s === ORDER_SORTING.ASC ? ORDER_SORTING.DESC : ORDER_SORTING.ASC];
      }
      return [c, s];
    }) : [value[0], value[1] === ORDER_SORTING.ASC ? ORDER_SORTING.DESC : ORDER_SORTING.ASC];
    this.onChange(newValue);
  }
  valueRenderer(opt) {
    const { label, value } = opt || {};
    const [column, sortOrder] = value;
    return <div>{label || column}<button className="m-l-5" onClick={() => this.changeSortOrder(column)}><i className={`fa fa-sort-amount-${sortOrder.toLowerCase()}`} /></button></div>;
  }
  render() {
    const placeholder = this.props.placeholder || t('%s option(s)', this.props.options.length);
    const {
      multi,
      name,
      value,
      clearable,
      isLoading,
      optionRenderer,
      filterOptions,
      disabled,
      showHeader,
      selectWrap,
      className,
      refFunc,
    } = this.props;
    const columnValues = multi ? (value || []).map(v => v[0]) : [value[0]];
    const optionsColumn = this.props.options.map(option => option.value[0]);

    let valueSelect;
    if (multi) {
      valueSelect = (value || []).filter(v => optionsColumn.includes(v[0]));
    } else {
      valueSelect = optionsColumn.includes(value[0]) ? value : '';
    }
    const options = (this.props.options || []).filter((option) => {
      const [column] = option.value;
      return !columnValues.includes(column);
    }).map((o) => {
      const [key] = o.value;
      return {
        ...o,
        key,
      };
    });
    const selectProps = {
      multi,
      name: `select-${name}`,
      placeholder,
      options,
      value: multi ? valueSelect.map(v => ({
        key: v[0],
        value: v,
        label: (this.props.options || []).find(o => o.value[0] === v[0])?.label ?? v[0],
      })) : valueSelect[0],
      labelKey: 'label',
      valueKey: 'key',
      autosize: false,
      clearable,
      isLoading,
      onChange: this.onChange,
      optionRenderer: VirtualizedRendererWrap(optionRenderer),
      valueRenderer: this.valueRenderer,
      filterOptions,
      selectComponent: Select,
      disabled,
      noResultsText: t('No results found'),
      refFunc,
    };
    return (
      <div className={className || null}>
        {showHeader &&
          <ControlHeader {...this.props} />
        }
        <OnPasteSelect {...selectProps} selectWrap={selectWrap} />
      </div>
    );
  }
}

SelectOrderControl.propTypes = propTypes;
SelectOrderControl.defaultProps = defaultProps;
