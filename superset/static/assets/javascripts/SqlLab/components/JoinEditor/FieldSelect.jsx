import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

import './FieldSelect.less';
import { t } from '../../../locales';

const propTypes = {
    fields: PropTypes.array,
    onChange: PropTypes.func,
    value: PropTypes.string,
    label: PropTypes.string,
};

class FieldSelect extends React.Component {

    constructor(props) {
        super(props);
        this.handleOnCahnge = this.handleOnCahnge.bind(this);
    }

    handleOnCahnge({ value }) {
        this.props.onChange(value);
    }

    render() {
        const fields = this.props.fields || [];
        return (
          <Select
            id={this.props.label}
            className="field-select-container"
            placeholder={t('Select a field')}
            options={
                    fields.map((field) => {
                        const { name, verbose_name: verboseName } = field;
                        return {
                            value: name,
                            label: verboseName ? `${verboseName}(${name})` : name,
                        };
                    })
                }
            value={this.props.value}
            autosize={false}
            onChange={this.handleOnCahnge}
            filterOption={
                (option, filter) => (filter && filter.length) ? !!(option.label.toLowerCase().indexOf(filter.toLowerCase()) > -1) : true
            }
          />
        );
    }
}

FieldSelect.propTypes = propTypes;

export default FieldSelect;
