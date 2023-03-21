import React, { PropTypes } from 'react';
import { Button, Row, Col } from 'react-bootstrap';
import shortid from 'shortid';
import FilterNode from './FilterNode';
import { t } from '../../../locales';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
  value: [],
};

export default class FilterWithGroupControl extends React.Component {
  shouldComponentUpdate(nextProps) {
    const allPropsMatched = Object.keys(nextProps)
      .filter(key => key !== 'hovered')
      .every(key => nextProps[key] === this.props[key]);
    return !allPropsMatched;
  }
  addFilter() {
    const newFilters = Object.assign([], this.props.value);
    const col =
      this.props.datasource && this.props.datasource.filterable_cols.length > 0
        ? this.props.datasource.filterable_cols[0][0]
        : null;
    newFilters.push({
      col,
      op: 'in',
      val: this.props.datasource.filter_select ? [] : '',
      id: shortid.generate(),
      conjuction: 'and',
      path: [],
    });
    this.props.onChange(newFilters);
  }

  render() {
    const filters = this.props.value.map((filter, index) => (
      <FilterNode
        key={filter.id}
        filter={filter}
        controlsActive={index !== this.props.value.length - 1}
        datasource={this.props.datasource}
        value={this.props.value}
        onChange={this.props.onChange}
      />
    ));
    return (
      <div>
        {filters}
        {!filters.length && (
          <Row className="space-2">
            <Col md={2}>
              <Button
                id="add-button"
                bsSize="sm"
                onClick={this.addFilter.bind(this)}
              >
                <i className="fa fa-plus" /> &nbsp; {t('Add Filters')}
              </Button>
            </Col>
          </Row>
        )}
      </div>
    );
  }
}

FilterWithGroupControl.propTypes = propTypes;
FilterWithGroupControl.defaultProps = defaultProps;
