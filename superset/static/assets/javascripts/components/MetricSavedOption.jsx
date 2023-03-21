import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { metricControl } from '../utils/metricControlsRender';

import * as ExploreActions from '../explore/actions/exploreActions';
import { OverlayTrigger } from "react-bootstrap";

import InfoTooltipWithTrigger from "./InfoTooltipWithTrigger";
import EditSavedMetricPopover from "../explore/components/EditSavedMetricPopover";

const propTypes = {
  metric: PropTypes.object.isRequired,
  openInNewWindow: PropTypes.bool,
  showFormula: PropTypes.bool,
  url: PropTypes.string,
  specificMetricFormat: PropTypes.string,
  actions: PropTypes.object,
  column_formats: PropTypes.object,
  commonMetricFormatValue: PropTypes.string
};

const defaultProps = {
  showFormula: true,
};

const Wrapper = styled.div`
  display: flex;
  .m-r-5 {
    display: block;
    white-space: normal;
  }
`;

class MetricSavedOption extends React.Component {
  constructor(props) {
    super(props);
    this.closeMetricEditOverlay = this.closeMetricEditOverlay.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  closeMetricEditOverlay() {
    this.refs.overlay.hide();
  }

  onChange(metric) {
    this.props.actions.setColumnFormats(metric)
  }

  render() {
    const {
      className,
      metric,
      openInNewWindow,
      showFormula,
      url,
      column_format,
      column_formats
    } = this.props;

    const metricName = metric.metric_name
    const specificMetricFormat = column_format?.[metricName]
    const dataMetricFormat = column_formats?.[metricName]
    const verbose = metric.verbose_name || metric.metric_name;

    let specSpecificMetricFormat = specificMetricFormat || dataMetricFormat || '';
    if(metricName in column_format && !column_format[metricName]) {
      specSpecificMetricFormat = ''
    }

    const link = url ? (
      <a href={url} target={openInNewWindow ? "_blank" : null}>
        {verbose}
      </a>
    ) : (
      verbose
    );
    const overlay = (
      <EditSavedMetricPopover
        specificMetricFormatValue={specSpecificMetricFormat}
        dataMetricFormat={dataMetricFormat}
        onChange={this.onChange}
        onClose={this.closeMetricEditOverlay}
        metricName={metricName}
        commonMetricFormatValue={this.props.commonMetricFormatValue}
      />
    );

    const shouldShowDefaultPopup = Array.isArray(metricControl.value) && !metricControl.value.includes(metricName)
    if (shouldShowDefaultPopup) {
      metricControl.value.push(metricName)
    }

    return (
      <OverlayTrigger
        trigger="click"
        placement="right"
        overlay={overlay}
        ref="overlay"
        rootClose
        defaultOverlayShown={!metricControl.isRenderedRecently && shouldShowDefaultPopup}
      >
        <Wrapper className={className}>
          <span className="m-r-5 option-label">{link}</span>
          {metric.description && (
            <InfoTooltipWithTrigger
              className="m-r-5 text-muted"
              icon="info"
              tooltip={metric.description}
              label={`descr-${metric.metric_name}`}
            />
          )}
          {showFormula && (
            <InfoTooltipWithTrigger
              className="m-r-5 text-muted"
              icon="question-circle-o"
              tooltip={metric.expression}
              label={`expr-${metric.metric_name}`}
            />
          )}
          {metric.warning_text && (
            <InfoTooltipWithTrigger
              className="m-r-5 text-danger"
              icon="warning"
              tooltip={metric.warning_text}
              label={`warn-${metric.metric_name}`}
            />
          )}
        </Wrapper>
      </OverlayTrigger>
    );
  }
}

MetricSavedOption.propTypes = propTypes;
MetricSavedOption.defaultProps = defaultProps;


const mapStateToProps = ({ explore }) => ({
    column_format: {...explore?.slice?.form_data?.column_format, ...explore?.datasource?.column_format },
    column_formats: explore?.datasource?.column_formats,
    commonMetricFormatValue: explore?.controls?.number_format?.value || explore?.rawFormData?.number_format
  });

const mapDispatchToProps = dispatch => ({
  actions: bindActionCreators(ExploreActions, dispatch)
});

export default connect(mapStateToProps, mapDispatchToProps)(MetricSavedOption);
