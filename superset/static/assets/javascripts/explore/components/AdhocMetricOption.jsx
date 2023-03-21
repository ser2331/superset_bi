import React from 'react';
import PropTypes from 'prop-types';
import { Label, OverlayTrigger } from 'react-bootstrap';

import AdhocMetricEditPopover from './AdhocMetricEditPopover';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';
import {getAggregateTranslateLabel} from "../../../javascripts/utils/common"

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onMetricEdit: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
  Popover: PropTypes.func,
};

export default class AdhocMetricOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeMetricEditOverlay = this.closeMetricEditOverlay.bind(this);
  }

  closeMetricEditOverlay() {
    const { adhocMetric } = this.props;
    adhocMetric.setShowPopover(false);
    this.refs.overlay.hide();
  }

  render() {
    const { adhocMetric, Popover, vizType } = this.props;
    const { key } = adhocMetric || {};
    const overlay = Popover ? (<Popover
      adhocMetric={adhocMetric}
      onChange={this.props.onMetricEdit}
      onClose={this.closeMetricEditOverlay}
    />) : (
      <AdhocMetricEditPopover
        adhocMetric={adhocMetric}
        onChange={this.props.onMetricEdit}
        onClose={this.closeMetricEditOverlay}
        columns={this.props.columns}
        datasourceType={this.props.datasourceType}
        vizType={vizType}
      />
    );

    return (
      <OverlayTrigger
        key={key}
        ref="overlay"
        placement="right"
        trigger="click"
        disabled
        overlay={overlay}
        rootClose
        defaultOverlayShown={!adhocMetric.fromFormData && adhocMetric.showPopover}
      >
        <Label style={{ margin: this.props.multi ? 0 : 3, cursor: 'pointer' }}>
          <div onMouseDownCapture={(e) => { e.stopPropagation(); }}>
            <span className="m-r-5 option-label">
               {getAggregateTranslateLabel(adhocMetric.label) || adhocMetric.label}
            </span>
          </div>
        </Label>
      </OverlayTrigger>
    );
  }
}
AdhocMetricOption.propTypes = propTypes;
