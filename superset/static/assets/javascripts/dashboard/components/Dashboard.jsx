/* global notify */
import React from 'react';
import PropTypes from 'prop-types';

import AlertsWrapper from '../../components/AlertsWrapper';
import GridLayout from './GridLayout';
import Header from './Header';
import { exportChart } from '../../explore/exploreUtils';
import { exportHTMLTOPDF } from '../../explore/exportPDF';
import { fetchAsyncRunQueries } from '../../utils/common';
import { areObjectsEqual } from '../../reduxUtils';
import {
  Logger,
  ActionLog,
  LOG_ACTIONS_PAGE_LOAD,
  LOG_ACTIONS_LOAD_EVENT,
  LOG_ACTIONS_RENDER_EVENT,
} from '../../logger';
import { t } from '../../locales';
import { getWheres } from '../../utils/common';
import queryString from 'query-string';
import shortid from 'shortid';

import '../../../stylesheets/dashboard.css';

const $ = (window.$ = require('jquery'));

const propTypes = {
  actions: PropTypes.object,
  initMessages: PropTypes.array,
  dashboard: PropTypes.object.isRequired,
  slices: PropTypes.object,
  datasources: PropTypes.object,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
  timeout: PropTypes.number,
  userId: PropTypes.string,
  isStarred: PropTypes.bool,
  editMode: PropTypes.bool,
  impressionId: PropTypes.string,
  unsavedChanges: PropTypes.bool,
};

const defaultProps = {
  initMessages: [],
  dashboard: {},
  slices: {},
  datasources: {},
  filters: {},
  refresh: false,
  timeout: 60,
  userId: '',
  isStarred: false,
  editMode: false,
  unsavedChanges: false,
};

class Dashboard extends React.PureComponent {
  constructor(props) {
    super(props);
    this.refreshTimer = null;
    this.firstLoad = true;
    this.loadingLog = new ActionLog({
      impressionId: props.impressionId,
      actionType: LOG_ACTIONS_PAGE_LOAD,
      source: 'dashboard',
      sourceId: props.dashboard.id,
      eventNames: [LOG_ACTIONS_LOAD_EVENT, LOG_ACTIONS_RENDER_EVENT],
    });
    Logger.start(this.loadingLog);

    // alert for unsaved changes
    this.state = {
      unsavedChanges: props.unsavedChanges,
      exportedPdf: false,
      asyncReqStarted: false,
      drilldown: false,
      left: 0,
      top: 0,
    };
    this.top = 0;
    this.left = 0;
    this.dragDrilldownWindow = this.dragDrilldownWindow.bind(this);
    this.endDragDrilldownWindow = this.endDragDrilldownWindow.bind(this);
    this.rerenderCharts = this.rerenderCharts.bind(this);
    this.updateDashboardTitle = this.updateDashboardTitle.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onChange = this.onChange.bind(this);
    this.handleAsyncReqStarted = this.handleAsyncReqStarted.bind(this);
    this.serialize = this.serialize.bind(this);
    this.fetchAllSlices = this.fetchSlices.bind(this, this.getAllSlices());
    this.startPeriodicRender = this.startPeriodicRender.bind(this);
    this.addSlicesToDashboard = this.addSlicesToDashboard.bind(this);
    this.fetchSlice = this.fetchSlice.bind(this);
    this.getFormDataExtra = this.getFormDataExtra.bind(this);
    this.exploreChart = this.exploreChart.bind(this);
    this.exportCSV = this.exportCSV.bind(this);
    this.exportExcel = this.exportExcel.bind(this);
    this.exportToPDF = this.exportToPDF.bind(this);
    this.props.actions.fetchFaveStar = this.props.actions.fetchFaveStar.bind(this);
    this.props.actions.saveFaveStar = this.props.actions.saveFaveStar.bind(this);
    this.props.actions.clearDrilldownCharts = this.props.actions.clearDrilldownCharts.bind(this);
    this.props.actions.OpenDrilldown = this.props.actions.OpenDrilldown.bind(this);
    this.props.actions.closeDrilldown = this.props.actions.closeDrilldown.bind(this);
    this.props.actions.saveSlice = this.props.actions.saveSlice.bind(this);
    this.props.actions.removeSlice = this.props.actions.removeSlice.bind(this);
    this.props.actions.removeChart = this.props.actions.removeChart.bind(this);
    this.props.actions.updateDashboardLayout = this.props.actions.updateDashboardLayout.bind(this);
    this.props.actions.toggleExpandSlice = this.props.actions.toggleExpandSlice.bind(this);
    this.props.actions.addFilter = this.props.actions.addFilter.bind(this);
    this.props.actions.clearFilter = this.props.actions.clearFilter.bind(this);
    this.props.actions.removeFilter = this.props.actions.removeFilter.bind(this);
    this.props.actions.setAsyncResponseToRender = this.props.actions.setAsyncResponseToRender.bind(
      this
    );
  }

  componentDidMount() {
    window.addEventListener('resize', this.rerenderCharts);
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ top: nextProps.top, left: nextProps.left });
    if (
      this.firstLoad &&
      Object.values(nextProps.slices).every(
        (slice) => ['rendered', 'failed', 'stopped'].indexOf(slice.chartStatus) > -1
      )
    ) {
      Logger.end(this.loadingLog);
      this.firstLoad = false;
    }

    if (nextProps.unsavedChanges !== this.props.unsavedChanges) {
      this.setState({ unsavedChanges: true });
    }
  }

  handleAsyncReqStarted() {
    this.setState({ asyncReqStarted: true });
  }

  componentDidUpdate(prevProps) {
    if (this.props.refresh) {
      let changedFilterKey;
      const prevFiltersKeySet = new Set(Object.keys(prevProps.filters));
      Object.keys(this.props.filters).some((key) => {
        prevFiltersKeySet.delete(key);
        if (
          prevProps.filters[key] === undefined ||
          !areObjectsEqual(prevProps.filters[key], this.props.filters[key])
        ) {
          changedFilterKey = key;
          return true;
        }
        return false;
      });
      // has changed filter or removed a filter?
      if (!!changedFilterKey || prevFiltersKeySet.size) {
        this.refreshExcept(changedFilterKey);
      }
    }

    if (!this.props.dataForAsyncRender.length) {
      this.setState({ asyncReqStarted: false });
    }

    const data = this.props.dataForAsyncRender;

    const isAllowAsync =
      this.props.checkAsyncModeForAddedSlice ||
      this.props.dashboard.slices[0]?.allow_run_async ||
      false;

    const isAllLoaded = !!data.length && data.every(({ isLoading }) => isLoading === false);

    if (
      isAllowAsync &&
      isAllLoaded &&
      this.props.dataForAsyncRender.length &&
      !this.state.asyncReqStarted
    ) {
      fetchAsyncRunQueries(
        this.props.dataForAsyncRender,
        this.handleAsyncReqStarted,
        this.props.actions.setAsyncResponseToRender,
        this.props.actions.removeElForAsyncRender
      );
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.rerenderCharts);
  }

  onBeforeUnload(hasChanged) {
    if (hasChanged) {
      window.addEventListener('beforeunload', this.unload);
    } else {
      window.removeEventListener('beforeunload', this.unload);
    }
  }

  onChange() {
    this.onBeforeUnload(true);
    this.setState({ unsavedChanges: true });
  }

  onSave() {
    this.onBeforeUnload(false);
    this.setState({ unsavedChanges: false });
  }

  // return charts in array
  getAllSlices() {
    return Object.values(this.props.slices);
  }

  getFormDataExtra(slice, drilldown) {
    const formDataExtra = Object.assign({}, slice.formData);
    const extraFilters = this.effectiveExtraFilters(slice.slice_id, drilldown);
    formDataExtra.extra_filters = extraFilters;
    if (this.props.extra_where) {
      formDataExtra.where = getWheres([formDataExtra.where, this.props.extra_where]);
    }
    formDataExtra.extra_where = this.props.extra_where;
    if (drilldown) {
      formDataExtra.where = getWheres([formDataExtra.where, this.props.drilldown_where]);
      formDataExtra.extra_where = this.drilldown_where;
    }

    return formDataExtra;
  }

  getFilters(sliceId) {
    return this.props.filters[sliceId];
  }

  unload() {
    const message = t('You have unsaved changes.');
    window.event.returnValue = message; // Gecko + IE
    return message; // Gecko + Webkit, Safari, Chrome etc.
  }

  effectiveExtraFilters(sliceId, drilldown) {
    const metadata = this.props.dashboard.metadata;
    const slice = drilldown
      ? this.props.drilldownData.find((data) => data.charts[`slice_${sliceId}_drilldown`]).charts[
          `slice_${sliceId}_drilldown`
        ]
      : this.props.slices[`slice_${sliceId}`];
    const filters = slice.formData?.viz_type === 'filter_box' ? {} : { ...this.props.filters };

    const drilldownFilters =
      slice.formData?.viz_type === 'filter_box'
        ? {}
        : {
            ...this.props.filters,
            ...this.props.drilldownData?.[0].dashboard.filters,
          };
    const f = [];
    const immuneSlices = metadata.filter_immune_slices || [];
    if (sliceId && immuneSlices.includes(sliceId)) {
      // The slice is immune to dashboard filters
      return f;
    }

    // Building a list of fields the slice is immune to filters on
    let immuneToFields = [];
    if (
      sliceId &&
      metadata.filter_immune_slice_fields &&
      metadata.filter_immune_slice_fields[sliceId]
    ) {
      immuneToFields = metadata.filter_immune_slice_fields[sliceId];
    }
    const setFilters = (filters) => {
      for (const filteringSliceId in filters) {
        const dashboardLevelFilters = filters[filteringSliceId];
        dashboardLevelFilters.forEach((filter) => {
          f.push(filter);
        });
      }
    };
    drilldown ? setFilters(drilldownFilters) : setFilters(filters);

    return f;
  }

  refreshExcept(filterKey) {
    const immune = this.props.dashboard.metadata.filter_immune_slices || [];
    let slices = this.getAllSlices();
    if (filterKey) {
      slices = slices.filter(
        (slice) => String(slice.slice_id) !== filterKey && immune.indexOf(slice.slice_id) === -1
      );
    }
    this.fetchSlices(slices);
  }

  stopPeriodicRender() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  startPeriodicRender(interval) {
    this.stopPeriodicRender();
    const immune = this.props.dashboard.metadata.timed_refresh_immune_slices || [];
    const refreshAll = () => {
      const affectedSlices = this.getAllSlices().filter(
        (slice) => immune.indexOf(slice.slice_id) === -1
      );
      this.fetchSlices(affectedSlices, true, interval * 0.2);
    };
    const fetchAndRender = () => {
      refreshAll();
      if (interval > 0) {
        this.refreshTimer = setTimeout(fetchAndRender, interval);
      }
    };

    fetchAndRender();
  }

  updateDashboardTitle(title) {
    this.props.actions.updateDashboardTitle(title);
    this.onChange();
  }

  serialize() {
    return this.props.dashboard.layout.map((reactPos) => ({
      slice_id: reactPos.i,
      col: reactPos.x + 1,
      row: reactPos.y,
      size_x: reactPos.w,
      size_y: reactPos.h,
    }));
  }

  addSlicesToDashboard(sliceIds, callBack) {
    return this.props.actions.addSlicesToDashboard(sliceIds, callBack);
  }

  fetchSlice(slice, force = false, drilldown = false) {
    const isStopAsync = true;
    return this.props.actions.runQuery(
      this.getFormDataExtra(slice, drilldown),
      force,
      this.props.timeout,
      slice.chartKey,
      isStopAsync
    );
  }

  // fetch and render an list of slices
  fetchSlices(slc, force = false, interval = 0) {
    const slices = slc || this.getAllSlices();
    if (!interval) {
      slices.forEach((slice) => {
        this.fetchSlice(slice, force);
      });
      return;
    }

    const meta = this.props.dashboard.metadata;
    const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
    if (typeof meta.stagger_refresh !== 'boolean') {
      meta.stagger_refresh =
        meta.stagger_refresh === undefined ? true : meta.stagger_refresh === 'true';
    }
    const delay = meta.stagger_refresh ? refreshTime / (slices.length - 1) : 0;
    slices.forEach((slice, i) => {
      setTimeout(() => {
        this.fetchSlice(slice, force);
      }, delay * i);
    });
  }

  exploreChart(slice, drilldown = false) {
    const formData = this.getFormDataExtra(slice, drilldown);
    exportChart(formData);
  }

  exportCSV(slice, drilldown = false) {
    const formData = this.getFormDataExtra(slice, drilldown);
    exportChart(formData, 'csv');
  }

  exportExcel(slice, drilldown = false) {
    const formData = this.getFormDataExtra(slice, drilldown);
    exportChart(formData, 'excel');
  }

  // экспорт Дашборда, слайсов в pdf
  async exportToPDF(element, type) {
    this.setState({ exportedPdf: true });
    notify.info(t('Start export PDF'));
    try {
      await exportHTMLTOPDF(element, type);
    } catch (e) {
      notify.error(t('Error export PDF'));
    }
    this.setState({ exportedPdf: false });
  }

  // re-render chart without fetch
  rerenderCharts() {
    this.getAllSlices().forEach((slice) => {
      setTimeout(() => {
        this.props.actions.renderTriggered(new Date().getTime(), slice.chartKey);
      }, 50);
    });
  }

  dragDrilldownWindow(e) {
    const box = e.target.getBoundingClientRect();
    const top = e.pageY - (box.top + pageYOffset);
    const left = e.pageX - (box.left + pageXOffset);
    this.top = top;
    this.left = left;
  }

  endDragDrilldownWindow(e) {
    this.setState({ top: e.pageY - this.top + 'px', left: e.pageX - this.left + 'px' });
  }

  openDashboardInNewWindow() {
    const data = this.props.drilldownData[0];
    const dashboardId = data.dashboard.dashboard.id;
    const preselect_filters = data.dashboard.filters;
    const extra_where = this.props.drilldown_where;
    const url = queryString.parse(location.search);
    const hid = url.hid || shortid.generate();
    const hidIndex = Number.parseInt(url.hid_index) || 0;
    try {
      const preselect_filters_key = shortid.generate();
      sessionStorage.setItem(preselect_filters_key, JSON.stringify(preselect_filters));
      this.props.actions.saveDashboardState(hid, hidIndex);
      const dataKey = shortid.generate();
      const data = { extra_where, filters: preselect_filters };
      sessionStorage.setItem(dataKey, JSON.stringify(data));
      window.open(
        `/superset/dashboard/${dashboardId}/?preselect_filters_key=${preselect_filters_key}&hid=${hid}&hid_index=${hidIndex +
          1}&data_key=${dataKey}`
      );
    } catch (e) {
      console.log(e);
    }
  }

  render() {
    const drilldown = this.props.drilldownData && this.props.drilldownData.length > 0;
    return (
      <div id="dashboard-container">
        <div id="dashboard-header">
          <AlertsWrapper initMessages={this.props.initMessages} />
          <Header
            dashboard={this.props.dashboard}
            unsavedChanges={this.state.unsavedChanges}
            filters={this.props.filters}
            userId={this.props.userId}
            isStarred={this.props.isStarred}
            updateDashboardTitle={this.updateDashboardTitle}
            onSave={this.onSave}
            onChange={this.onChange}
            serialize={this.serialize}
            fetchFaveStar={this.props.actions.fetchFaveStar}
            saveFaveStar={this.props.actions.saveFaveStar}
            renderSlices={this.fetchAllSlices}
            startPeriodicRender={this.startPeriodicRender}
            addSlicesToDashboard={this.addSlicesToDashboard}
            editMode={this.props.editMode}
            setEditMode={this.props.actions.setEditMode}
            exportToPDF={this.exportToPDF}
            allSliceLoaded={Object.values(this.props.slices).every(
              (slice) => slice.chartStatus === 'rendered'
            )}
            exportedPdf={this.state.exportedPdf}
          />
        </div>
        <div id="grid-container" className="slice-grid gridster">
          <GridLayout
            dashboard={this.props.dashboard}
            datasources={this.props.datasources}
            filters={this.props.filters}
            charts={this.props.slices}
            timeout={this.props.timeout}
            isResizable={true}
            openDrilldown={this.props.actions.OpenDrilldown}
            closeDrilldown={this.props.actions.closeDrilldown}
            clearDrilldownCharts={this.props.actions.clearDrilldownCharts}
            onChange={this.onChange}
            getFormDataExtra={this.getFormDataExtra}
            exploreChart={this.exploreChart}
            exportCSV={this.exportCSV}
            exportExcel={this.exportExcel}
            exportPDF={this.exportToPDF}
            exportedPdf={this.state.exportedPdf}
            fetchSlice={this.fetchSlice}
            saveSlice={this.props.actions.saveSlice}
            removeSlice={this.props.actions.removeSlice}
            removeChart={this.props.actions.removeChart}
            updateDashboardLayout={this.props.actions.updateDashboardLayout}
            toggleExpandSlice={this.props.actions.toggleExpandSlice}
            addFilter={this.props.actions.addFilter}
            getFilters={this.getFilters}
            clearFilter={this.props.actions.clearFilter}
            removeFilter={this.props.actions.removeFilter}
            editMode={this.props.editMode}
            revertSliceState={this.props.actions.revertSliceState}
          />
          {drilldown && this.props.drilldownData ? (
            <div
              className="popup-drilldown"
              style={{
                left: this.state.left,
                top: this.state.top,
              }}
            >
              <div
                className="popup-drilldown-button close-popup"
                onClick={() => this.props.actions.closeDrilldown(this.props.selectedItem)}
              >
                <i className="fa fa-times"></i>
              </div>
              <div
                className="popup-drilldown-button open-link"
                onClick={(e) => this.openDashboardInNewWindow(e)}
              >
                <i className="fa fa-external-link"></i>
              </div>
              <div
                className="popup-drilldown-controlpanel"
                onDragStart={(e) => this.dragDrilldownWindow(e)}
                onDragEnd={(e) => this.endDragDrilldownWindow(e)}
                draggable
              ></div>
              <div className="popup-drilldown-dashboard">
                {this.props.drilldownData.map((data) => (
                  <GridLayout
                    drilldown={drilldown}
                    dashboard={data.dashboard.dashboard}
                    datasources={data.dashboard.datasources}
                    filters={data.dashboard.filters}
                    charts={{ ...data.charts, ...this.props.slices }}
                    timeout={data.timeout}
                    isResizable={false}
                    onChange={this.onChange}
                    getFormDataExtra={this.getFormDataExtra}
                    exploreChart={this.exploreChart}
                    exportCSV={this.exportCSV}
                    exportExcel={this.exportExcel}
                    exportPDF={this.exportToPDF}
                    exportedPdf={this.state.exportedPdf}
                    fetchSlice={this.fetchSlice}
                    saveSlice={this.props.actions.saveSlice}
                    removeSlice={this.props.actions.removeSlice}
                    removeChart={this.props.actions.removeChart}
                    updateDashboardLayout={this.props.actions.updateDashboardLayout}
                    toggleExpandSlice={this.props.actions.toggleExpandSlice}
                    addFilter={this.props.actions.addFilter}
                    getFilters={this.getFilters}
                    clearFilter={this.props.actions.clearFilter}
                    removeFilter={this.props.actions.removeFilter}
                    editMode={data.editMode}
                    revertSliceState={this.props.actions.revertSliceState}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
