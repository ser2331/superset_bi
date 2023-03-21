import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as dashboardActions from '../actions';
import * as chartActions from '../../chart/chartAction';
import Dashboard from './Dashboard';

function mapStateToProps(props) {
  return {
    initMessages: props.dashboard.common.flash_messages,
    timeout: props.dashboard.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    dashboard: props.dashboard.dashboard,
    slices: props.charts,
    datasources: props.dashboard.datasources,
    drilldown: props.dashboard.drilldown,
    drilldownData: props.dashboard.drilldownData,
    drilldown_where: props.dashboard.wheres,
    left: props.dashboard.left,
    top: props.dashboard.top,
    selectedItem: props.dashboard.selectedItem,
    filters: props.dashboard.filters,
    refresh: !!props.dashboard.refresh,
    userId: props.dashboard.userId,
    isStarred: !!props.dashboard.isStarred,
    editMode: props.dashboard.editMode,
    impressionId: props.impressionId,
    prevState: props.dashboard.dashboard.prevState,
    extra_where: props.dashboard.extra_where,
    unsavedChanges: props.dashboard.unsavedChanges,
    dataForAsyncRender: props.dashboard.dataForAsyncRender,
    checkAsyncModeForAddedSlice: props.dashboard.checkAsyncModeForAddedSlice,
  };
}

function mapDispatchToProps(dispatch) {
  const actions = { ...chartActions, ...dashboardActions };
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
