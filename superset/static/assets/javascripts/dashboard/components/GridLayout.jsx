import React from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';

import GridCell from './GridCell';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './GridLayout.css';

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.object.isRequired,
  filters: PropTypes.object,
  timeout: PropTypes.number,
  onChange: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  fetchSlice: PropTypes.func,
  saveSlice: PropTypes.func,
  removeSlice: PropTypes.func,
  removeChart: PropTypes.func,
  updateDashboardLayout: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  revertSliceState: PropTypes.func,
  exportExcel: PropTypes.func,
  exportPDF: PropTypes.func,
  exportedPdf: PropTypes.bool,
};

const defaultProps = {
  onChange: () => ({}),
  getFormDataExtra: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  exportPDF: () => ({}),
  fetchSlice: () => ({}),
  saveSlice: () => ({}),
  removeSlice: () => ({}),
  removeChart: () => ({}),
  updateDashboardLayout: () => ({}),
  toggleExpandSlice: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
  revertSliceState: () => ({}),
};

class GridLayout extends React.Component {
  constructor(props) {
    super(props);

    this.onResizeStop = this.onResizeStop.bind(this);
    this.onDragStop = this.onDragStop.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.removeSlice = this.removeSlice.bind(this);
    this.updateSliceName = this.props.dashboard.dash_edit_perm
      ? this.updateSliceName.bind(this)
      : null;
  }

  onResizeStop(layout) {
    this.props.updateDashboardLayout(layout);
    this.props.onChange();
  }

  onDragStop(layout) {
    this.props.updateDashboardLayout(layout);
    this.props.onChange();
  }

  getWidgetId(slice) {
    return 'widget_' + slice.slice_id;
  }

  getLegend(slice) {
    return 'slice-container-' + slice.slice_id + '-legend';
  }

  getLegendHeight = (slice) => {
    const legendId = this.getLegend(slice);

    const legend = document.getElementById(legendId);
    if (legend) {
      return legend.offsetHeight;
    }
    return 0;
  }

  getWidgetHeight(slice) {
    const widgetId = this.getWidgetId(slice);
    const legend = this.getLegendHeight(slice);

    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].offsetHeight - legend;
  }

  getWidgetWidth(slice) {
    const widgetId = this.getWidgetId(slice);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].offsetWidth;
  }

  findSliceIndexById(sliceId) {
    return this.props.dashboard.slices
      .map((slice) => slice.slice_id)
      .indexOf(sliceId);
  }

  forceRefresh(sliceId, drilldown = false) {
    const chart = drilldown
      ? this.props.charts[`slice_${sliceId}_drilldown`]
      : this.props.charts[`slice_${sliceId}`];
    return this.props.fetchSlice(chart, true, drilldown);
  }

  removeSlice(slice) {
    if (!slice) {
      return;
    }

    // remove slice dashboard and charts
    this.props.removeSlice(slice);
    this.props.removeChart(
      this.props.charts['slice_' + slice.slice_id].chartKey
    );
    this.props.onChange();
  }

  updateSliceName(sliceId, sliceName) {
    const index = this.findSliceIndexById(sliceId);
    if (index === -1) {
      return;
    }

    const currentSlice = this.props.dashboard.slices[index];
    if (currentSlice.slice_name === sliceName) {
      return;
    }

    this.props.saveSlice(currentSlice, sliceName);
  }

  isExpanded(slice) {
    return (
      this.props.dashboard.metadata.expanded_slices &&
      this.props.dashboard.metadata.expanded_slices[slice.slice_id]
    );
  }

  render() {
    const { slices_perms: slicesPerms } = this.props.dashboard || {};
    // проверка на возможность обзора слайса
    const exploredSlices = this.props.dashboard.slices.filter((slice) => {
      const { slice_id: sliceId } = slice;
      const { perms: permitions } = slicesPerms.find(
        (perms) => perms.id === sliceId
      );
      const { can_explore: canExplore } =
        permitions && permitions.length
          ? permitions.reduce((res, el) => ({ ...res, [el]: !!el }), {})
          : {};

      return canExplore;
    });
    const cells = exploredSlices.map((slice) => {
      const { slice_id: sliceId } = slice;
      const { perms: permitions } = slicesPerms.find(
        (perms) => perms.id === sliceId
      );
      const {
        can_edit: canEdit,
        can_explore: canExplore,
        can_download: canDownload,
      } =
        permitions && permitions.length
          ? permitions.reduce((res, el) => ({ ...res, [el]: !!el }), {})
          : {};
      const drilldown = this.props.drilldown;
      const chartKey = this.props.drilldown
        ? `slice_${slice.slice_id}_drilldown`
        : `slice_${slice.slice_id}`;
      const currentChart = this.props.charts[chartKey];
      const queryResponse = currentChart.queryResponse || {};
      const grid = this.props.dashboard.layout.find(
        (layout) => parseInt(layout.i, 10) === slice.slice_id
      );
      return (
        <div
          id={
            this.props.drilldown
              ? `slice_${slice.slice_id}_drilldown`
              : `slice_${slice.slice_id}`
          }
          key={
            this.props.drilldown
              ? `${slice.slice_id}_drilldown`
              : slice.slice_id
          }
          data-slice-id={slice.slice_id}
          className={
            this.props.drilldown
              ? `widget ${slice.form_data.viz_type} drilldown-cell`
              : `widget ${slice.form_data.viz_type}`
          }
          ref={this.getWidgetId(slice)}
          data-grid={{ ...grid }}
          style={{height: '100%'}}
        >
          <GridCell
            slice={slice}
            chartKey={chartKey}
            charts={this.props.charts}
            drilldown={drilldown}
            datasource={this.props.datasources[slice.form_data.datasource]}
            filters={this.props.filters}
            formData={this.props.getFormDataExtra(slice, drilldown)}
            timeout={this.props.timeout}
            widgetHeight={this.getWidgetHeight(slice)}
            widgetWidth={this.getWidgetWidth(slice)}
            exploreChart={this.props.exploreChart}
            exportCSV={this.props.exportCSV}
            exportPDF={this.props.exportPDF}
            exportedPdf={this.props.exportedPdf}
            isExpanded={!!this.isExpanded(slice)}
            isLoading={currentChart.chartStatus === 'loading'}
            isCached={queryResponse.is_cached}
            cachedDttm={queryResponse.cached_dttm}
            toggleExpandSlice={this.props.toggleExpandSlice}
            forceRefresh={this.forceRefresh}
            removeSlice={this.removeSlice}
            updateSliceName={this.updateSliceName}
            openDrilldown={this.props.openDrilldown}
            closeDrilldown={this.props.closeDrilldown}
            clearDrilldownCharts={this.props.clearDrilldownCharts}
            addFilter={this.props.addFilter}
            getFilters={this.props.getFilters}
            clearFilter={this.props.clearFilter}
            removeFilter={this.props.removeFilter}
            editMode={this.props.editMode}
            annotationQuery={currentChart.annotationQuery}
            annotationError={currentChart.annotationError}
            revertSliceState={this.props.revertSliceState}
            exportExcel={this.props.exportExcel}
            canEdit={canEdit}
            canExplore={canExplore}
            canDownload={canDownload}
          />
        </div>
      );
    });

    this.props.drilldown &&
      cells.sort((a, b) => {
        const y1 = a.props?.['data-grid'].y;
        const y2 = b.props?.['data-grid'].y;
        const x1 = a.props?.['data-grid'].x;
        const x2 = b.props?.['data-grid'].x;
        if (y1 === y2) {
          return x1 < x2 ? -1 : 1;
        } else {
          return y1 < y2 ? -1 : 1;
        }
      });

    return this.props.isResizable ? (
      <ResponsiveReactGridLayout
        className="layout"
        onResizeStop={this.onResizeStop}
        onDragStop={this.onDragStop}
        cols={{ lg: 48, md: 48, sm: 40, xs: 32, xxs: 24 }}
        rowHeight={10}
        autoSize
        margin={[20, 20]}
        useCSSTransforms
        draggableHandle=".drag"
      >
        {cells}
      </ResponsiveReactGridLayout>
    ) : (
      <div>{cells}</div>
    );
  }
}

GridLayout.propTypes = propTypes;
GridLayout.defaultProps = defaultProps;

export default GridLayout;

        // <ResponsiveReactGridLayout
        //   className="layout"
        //   onResizeStop={(layout) => this.props.updateDashboardLayout(layout)}
        //   onDragStop={(layout) => this.props.updateDashboardLayout(layout)}
        //   cols={{ lg: 48, md: 48, sm: 40, xs: 32, xxs: 24 }}
        //   rowHeight={10}
        //   autoSize = {true}
        //   margin={[10, 40]}
        //   useCSSTransforms
        //   draggableHandle=".drag"
        //   isDraggable={false}
        //   isResizable={false}
        // >
        // </ResponsiveReactGridLayout>
