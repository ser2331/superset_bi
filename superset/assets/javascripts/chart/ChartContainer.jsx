import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import * as Actions from './chartAction';
import * as ExploreActions from '../explore/actions/exploreActions';
import Chart from './Chart';

function mapStateToProps({ charts }, ownProps) {
  const chart = charts[ownProps.chartKey];
  return {
    annotationData: chart.annotationData,
    chartAlert: chart.chartAlert,
    chartStatus: chart.chartStatus,
    chartUpdateEndTime: chart.chartUpdateEndTime,
    chartUpdateStartTime: chart.chartUpdateStartTime,
    latestQueryFormData: chart.latestQueryFormData,
    lastRendered: chart.lastRendered,
    queryResponse: chart.queryResponse,
    queryRequest: chart.queryRequest,
    triggerQuery: chart.triggerQuery,
    prevFormData: chart.prevFormData,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
    exploreActions: bindActionCreators(ExploreActions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
