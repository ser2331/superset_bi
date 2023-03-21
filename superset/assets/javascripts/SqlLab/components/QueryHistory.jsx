import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';

import QueryTable from './QueryTable';
import { t } from '../../locales';

const propTypes = {
  queries: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
};

const QueryHistory = (props) => {
  if (props.queries.length > 0) {
    return (
      <QueryTable
        columns={[
          { key: 'state', label: t('State') },
          { key: 'started', label: t('Started') },
          { key: 'duration', label: t('Duration') },
          { key: 'progress', label: t('Progress') },
          { key: 'rows', label: t('Rows') },
          { key: 'sql', label: t('SQL Query') },
          { key: 'output', label: t('Output') },
          { key: 'actions', label: t('Actions') },
        ]}
        queries={props.queries}
        actions={props.actions}
      />
    );
  }
  return (
    <Alert bsStyle="info">
      {t('No query history yet...')}
    </Alert>
  );
};
QueryHistory.propTypes = propTypes;

export default QueryHistory;
