import React from 'react';
import PropTypes from 'prop-types';
import { ControlLabel, Label, OverlayTrigger, Tooltip } from 'react-bootstrap';
import _ from 'lodash';
import styled from 'styled-components';
import { t } from '../../../locales';
import Select, { Creatable } from 'react-select';

const StyledHierarchiesWrap = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  & > .label {
    margin-bottom: 5px;
  }
`;

const propTypes = {
    hierarchies: PropTypes.array,
    options: PropTypes.array,
    value: PropTypes.array,
    onChange: PropTypes.func,
    optionRenderer: PropTypes.func,
    valueRenderer: PropTypes.func,
    multi: PropTypes.bool,
    clearable: PropTypes.bool,
    isLoading: PropTypes.bool,
    name: PropTypes.string,
};

const defaultProps = {
    hierarchies: [],
    options: [],
    value: [],
    onChange: () => {},
    clearable: true,
    isLoading: false,
    name: 'select',
};

export default class SelectControlWithHierarchies extends React.PureComponent {
    constructor(props) {
        super(props);
        this.handlerOnClickHierarchic = this.handlerOnClickHierarchic.bind(this);
        this.onChange = this.onChange.bind(this);
    }

    handlerOnClickHierarchic(hierarchic, isContainsInValue = false) {

        const { columns } = hierarchic;
        const { value, onChange } = this.props;

        if (isContainsInValue) {
            onChange(_.difference(value, columns));
        } else {
            onChange(_.union(value, columns));
        }
    }

    renderHierarchicLabel(hierarchic, value = [], key) {
        const { name, columns } = hierarchic;
        const isContainsInValue = columns.every(column => value.indexOf(column) > -1);
        return (
          <OverlayTrigger
            key={key}
            placement="right"
            overlay={<Tooltip id={`hierarchie-help-${name}-${key}`}>{isContainsInValue ? t('Click to remove Hierarchie columns') : t('Click to add Hierarchie columns')}</Tooltip>}
          >
            <Label
              onClick={() => this.handlerOnClickHierarchic(hierarchic, isContainsInValue)}
              style={{ cursor: 'pointer' }}
              className={`m-r-5 ${isContainsInValue ? 'label-danger' : 'label-default'}`}
            >
              {name}
            </Label>
          </OverlayTrigger>
        );
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

    render() {
        const { hierarchies, options } = this.props;
        const opts = this.getOptions(this.props);
        const value = Array.isArray(this.props.value)
            ? this.props.value.map(item => opts.find((option) => {
                    if (typeof option === 'object') {
                        return option.column_name === item;
                    }
                    return option === item;
                }))
            : opts.find(option => option.column_name === this.props.value);
        const selectProps = {
            multi: this.props.multi,
            name: `select-${this.props.name}`,
            options: opts,
            placeholder: t('%s option(s)', options.length),
            value,
            autosize: false,
            clearable: this.props.clearable,
            isLoading: this.props.isLoading,
            onChange: this.onChange,
            optionRenderer: this.props.optionRenderer,
            valueRenderer: this.props.valueRenderer || (v => v),
            noResultsText: t('No results found'),
        };
        const selectWrap = this.props.freeForm ?
            (<Creatable {...selectProps} />) : (<Select {...selectProps} />);
        return (
          <div>
            {selectWrap}
            {(hierarchies && hierarchies.length) ?
              <div>
                <ControlLabel style={{
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                        }}
                >
                  <span>{t('Hierarchy for quick selection')}</span>
                </ControlLabel>
              </div> : null}
            {(hierarchies && hierarchies.length) ?
              <StyledHierarchiesWrap>
                {hierarchies.map((h, index) => this.renderHierarchicLabel(h, value || [], index))}
              </StyledHierarchiesWrap>
                    :
              null}
          </div>
        );
    }
}

SelectControlWithHierarchies.propTypes = propTypes;
SelectControlWithHierarchies.defaultProps = defaultProps;
