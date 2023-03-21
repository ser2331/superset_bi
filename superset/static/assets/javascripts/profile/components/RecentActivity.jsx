import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import TableLoader from './TableLoader';

const propTypes = {
  user: PropTypes.object,
};

export default class RecentActivity extends React.PureComponent {
  render() {
    const rowLimit = 50;
    const mutator = function (data) {
      return data.map(row => ({
        _name: row.item_title,
        name: <a href={row.item_url}>{row.item_title}</a>,
        type: row.action,
        time: moment.utc(row.time).fromNow(),
        _time: row.time,
      }));
    };
    return (
      <div>
        <TableLoader
          className="table table-condensed"
          mutator={mutator}
          dataEndpoint={`/superset/recent_activity/${
            this.props.user.userId
          }/?limit=${rowLimit}`}
          sortable
        />
      </div>
    );
  }
}
RecentActivity.propTypes = propTypes;
