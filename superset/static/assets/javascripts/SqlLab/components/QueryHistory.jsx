import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';
import { Resizable } from 're-resizable';

import QueryTable from './QueryTable';
import { t } from '../../locales';
import '../../../stylesheets/resizable.less';

const propTypes = {
  queries: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
  height: PropTypes.number,
};

const QueryHistory = (props) => {
  if (props.queries.length > 0) {
    return (
        <Resizable
            handleClasses={{ bottom: 'draggable-handle bottom bottom-zero' }}
            enable={{ bottom: true }}
            style={{ paddingBottom: '10px' }}
            minHeight={100}
        >
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
                height={props.height}
            />
        </Resizable>
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
