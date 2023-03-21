import React from 'react';
import PropTypes from 'prop-types';
import { Table, Tr, Td } from 'reactable';
import $ from 'jquery';

import { t } from '../../locales';
import '../../../stylesheets/reactable-pagination.css';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  mutator: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.string),
};

export default class TableLoader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      data: [],
    };
  }
  componentWillMount() {
    $.get(this.props.dataEndpoint, (data) => {
      let actualData = data;
      if (this.props.mutator) {
        actualData = this.props.mutator(data);
      }
      this.setState({ data: actualData, isLoading: false });
    });
  }

  capitalize(columnName) {
    if (columnName && columnName.length > 2) {
      const [firstLetter, ...rest] = columnName;
      return `${firstLetter.toUpperCase()}${rest.join('')}`;
    }
    return columnName;
  }

  render() {
    const tableProps = Object.assign({}, this.props);
    let { columns } = this.props;
    if (!columns && this.state.data.length > 0) {
      columns = Object.keys(this.state.data[0]).filter(col => col[0] !== '_');
    }
    delete tableProps.dataEndpoint;
    delete tableProps.mutator;
    delete tableProps.columns;
    if (this.state.isLoading) {
      return (
        <img alt="loading" width="25" src="/static/assets/images/loading.gif" />
      );
    }
    return (
      <Table
        {...tableProps}
        className="table"
        itemsPerPage={50}
        previousPageLabel={t('Prev')}
        nextPageLabel={t('Next')}
      >
        {this.state.data.map((row, i) => (
          <Tr key={i}>
            {columns.map((col) => {
              if (row.hasOwnProperty('_' + col)) {
                return (
                  <Td
                    key={col}
                    column={this.capitalize(t(col))}
                    value={row['_' + col]}
                  >
                    {t(row[col])}
                  </Td>
                );
              }
              return (
                <Td key={col} column={this.capitalize(t(col))}>
                  {t(row[col])}
                </Td>
              );
            })}
          </Tr>
        ))}
      </Table>
    );
  }
}
TableLoader.propTypes = propTypes;
