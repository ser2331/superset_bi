import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

import ColumnTypeLabel from '../../components/ColumnTypeLabel';
import aggregateOptionType from '../propTypes/aggregateOptionType';

const propTypes = {
  aggregate: aggregateOptionType,
  showType: PropTypes.bool,
};

const Wrapper = styled.div`
  display: flex;
  .m-r-5 {
    display: block;
    white-space: nowrap;
  }
`;


export default function AggregateOption({ aggregate, showType }) {
  return (
    <Wrapper>
      {showType && <ColumnTypeLabel type="aggregate" />}
      <span className="m-r-5 option-label">
        {aggregate.aggregate_name}
      </span>
    </Wrapper>
  );
}
AggregateOption.propTypes = propTypes;
