import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

import ColumnTypeLabel from './ColumnTypeLabel';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  column: PropTypes.object.isRequired,
  showType: PropTypes.bool,
};
const defaultProps = {
  showType: false,
};

const Wrapper = styled.div`
  display: flex;
  .m-r-5 {
    display: block;
    white-space: normal;
    word-break: break-all;
  }
`;

export default function ColumnOption({ className, column, showType }) {

  const hasExpression = column.expression && column.expression !== column.column_name;

  let columnType = column.type;
  if (column.is_dttm) {
    columnType = 'time';
  } else if (hasExpression) {
    columnType = 'expression';
  }

  return (
    <Wrapper className={className}>
      {showType && columnType && <ColumnTypeLabel type={columnType} />}
      <span className="m-r-5 option-label">
        {column.verbose_name || column.column_name}
      </span>
      {column.description &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={column.description}
          label={`descr-${column.column_name}`}
        />
      }
      {hasExpression &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={column.expression}
          label={`expr-${column.column_name}`}
        />
      }
    </Wrapper>);
}
ColumnOption.propTypes = propTypes;
ColumnOption.defaultProps = defaultProps;
