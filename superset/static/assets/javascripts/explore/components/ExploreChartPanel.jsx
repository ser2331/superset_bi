import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import { Panel } from 'react-bootstrap';

import { chartPropType } from '../../chart/chartReducer';
import ChartContainer from '../../chart/ChartContainer';
import ExploreChartHeader from './ExploreChartHeader';

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  onQuery: PropTypes.func,
  onDismissRefreshOverlay: PropTypes.func,
  can_favstar: PropTypes.bool.isRequired,
  can_edit: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  datasource: PropTypes.object,
  column_formats: PropTypes.object,
  containerId: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  width: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  vizType: PropTypes.string.isRequired,
  form_data: PropTypes.object,
  standalone: PropTypes.bool,
  timeout: PropTypes.number,
  refreshOverlayVisible: PropTypes.bool,
  chart: PropTypes.shape(chartPropType),
  errorMessage: PropTypes.node,
  dataForAsyncRender: PropTypes.array
};

class ExploreChartPanel extends React.PureComponent {
  getHeight() {
    const headerHeight = this.props.standalone ? 0 : 100;
    return parseInt(this.props.height, 10) - headerHeight;
  }

  renderChart() {
    return (
      <ChartContainer
        containerId={this.props.containerId}
        datasource={this.props.datasource}
        formData={this.props.form_data}
        height={this.getHeight()}
        slice={this.props.slice}
        chartKey={this.props.chart.chartKey}
        setControlValue={this.props.actions.setControlValue}
        timeout={this.props.timeout}
        vizType={this.props.vizType}
        refreshOverlayVisible={this.props.refreshOverlayVisible}
        errorMessage={this.props.errorMessage}
        onQuery={this.props.onQuery}
        onDismissRefreshOverlay={this.props.onDismissRefreshOverlay}
      />
    );
  }

  render() {
    if (this.props.standalone) {
      // dom manipulation hack to get rid of the boostrap theme's body background
      $('body').addClass('background-transparent');
      return this.renderChart();
    }

    const header = (
      <ExploreChartHeader
        actions={this.props.actions}
        addHistory={this.props.addHistory}
        canEdit={this.props.can_edit}
        canDownload={this.props.can_download}
        canFavstar={this.props.can_favstar}
        isStarred={this.props.isStarred}
        slice={this.props.slice}
        table_name={this.props.table_name}
        form_data={this.props.form_data}
        timeout={this.props.timeout}
        chart={this.props.chart}
      />);
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={header}
        >
          {this.renderChart()}
        </Panel>
      </div>
    );
  }
}

ExploreChartPanel.propTypes = propTypes;

export default ExploreChartPanel;
