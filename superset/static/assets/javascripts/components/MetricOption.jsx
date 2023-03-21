import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

import ColumnTypeLabel from './ColumnTypeLabel';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  metric: PropTypes.object.isRequired,
  openInNewWindow: PropTypes.bool,
  showFormula: PropTypes.bool,
  showType: PropTypes.bool,
  url: PropTypes.string,
};
const defaultProps = {
  showFormula: true,
  showType: false,
};

const Wrapper = styled.div`
  display: flex;
  .m-r-5 {
    display: block;
    white-space: normal;
  }
`;

export default function MetricOption({ className, metric, openInNewWindow, showFormula, showType, url }) {
  const verbose = metric.verbose_name || metric.metric_name;
  const link = url ? <a href={url} target={openInNewWindow ? '_blank' : null}>{verbose}</a> : verbose;
  return (
    <Wrapper className={className}>
      {showType && <ColumnTypeLabel type="expression" />}
      <span className="m-r-5 option-label">{link}</span>
      {metric.description &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={metric.description}
          label={`descr-${metric.metric_name}`}
        />
      }
      {showFormula &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={metric.expression}
          label={`expr-${metric.metric_name}`}
        />
      }
      {metric.warning_text &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-danger"
          icon="warning"
          tooltip={metric.warning_text}
          label={`warn-${metric.metric_name}`}
        />
      }
    </Wrapper>);
}
MetricOption.propTypes = propTypes;
MetricOption.defaultProps = defaultProps;
