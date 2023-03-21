import React from 'react';
import PropTypes from 'prop-types';

import { chartPropType } from '../../chart/chartReducer';
import ExploreActionButtons from './ExploreActionButtons';
import RowCountLabel from './RowCountLabel';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import CachedLabel from '../../components/CachedLabel';
import { t } from '../../locales';
import { exportHTMLTOPDF, TYPE_CONVERT_SLICE } from '../exportPDF';

export const STATUS_SUCCESS = 'success';
export const STATUS_DANGER = 'danger';
export const STATUS_WARNING = 'warning';
export const STATUS_RENDERED = 'rendered';

const CHART_STATUS_MAP = {
  failed: STATUS_DANGER,
  loading: STATUS_WARNING,
  success: STATUS_SUCCESS,
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  canEdit: PropTypes.bool.isRequired,
  canDownload: PropTypes.bool.isRequired,
  canFavstar: PropTypes.bool.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  timeout: PropTypes.number,
  chart: PropTypes.shape(chartPropType),
};

class ExploreChartHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.exportToPDF = this.exportToPDF.bind(this);
    this.state = { exportedPdf: false };
    this.isStopAsync = true;
  }
  runQuery() {
    this.props.actions.runQuery(
      this.props.form_data,
      true,
      this.props.timeout,
      this.props.chart.chartKey,
      this.isStopAsync
    );
  }

  // экспорт Slice в pdf
  async exportToPDF() {
    this.setState({ exportedPdf: true });
    notify.info(t('Start export PDF'));
    try {
      await exportHTMLTOPDF(
        document.querySelector('.chart-container'),
        TYPE_CONVERT_SLICE
      );
    } catch (e) {
      notify.error(t('Error export PDF'));
    }
    this.setState({ exportedPdf: false });
  }

  renderChartTitle() {
    let title;
    if (this.props.slice) {
      title = this.props.slice.slice_name;
    } else {
      title = t('%s - untitled', this.props.table_name);
    }
    return title;
  }

  render() {
    const { exportedPdf } = this.state;
    const { form_data: formData, slice: sliceData, canFavstar, canEdit, actions } = this.props;
    const {
      chartStatus,
      chartUpdateEndTime,
      chartUpdateStartTime,
      latestQueryFormData,
      queryResponse,
      sliceFormData,
    } = this.props.chart;
    const { updateChartTitle } = actions || {};
    const chartSucceeded =
      ['success', 'rendered'].indexOf(chartStatus) > 0;

    return (
      <div id='slice-header' className='clearfix panel-title-large'>
        <EditableTitle
          title={this.renderChartTitle()}
          canEdit={!this.props.slice || this.props.canEdit}
          onSaveTitle={updateChartTitle}
        />

        {this.props.slice && (
          <span>
            {canFavstar && this.props.slice.slice_id && (
              <FaveStar
                itemId={this.props.slice.slice_id}
                fetchFaveStar={actions.fetchFaveStar}
                saveFaveStar={actions.saveFaveStar}
                isStarred={this.props.isStarred}
              />
            )}
            {canEdit && (
              <TooltipWrapper
                label='edit-desc'
                tooltip={t('Edit chart properties')}
              >
                <a
                  className='edit-desc-icon'
                  href={`/slicemodelview/edit/${this.props.slice.slice_id}`}
                >
                  <i className='fa fa-edit' />
                </a>
              </TooltipWrapper>
            )}
          </span>
        )}
        {sliceFormData && (
          <AlteredSliceTag
            origFormData={sliceFormData}
            origSliceData={this.props.chart.sliceData || {}}
            currentFormData={formData || {}}
            currentSliceData={sliceData || {}}
          />
        )}
        <div className='pull-right'>
          {chartSucceeded && queryResponse && (
            <RowCountLabel
              rowcount={queryResponse.rowcount}
              limit={formData.row_limit}
            />
          )}
          {chartSucceeded && queryResponse?.is_cached && (
            <CachedLabel
              onClick={this.runQuery.bind(this)}
              cachedTimestamp={queryResponse.cached_dttm}
            />
          )}
          <Timer
            startTime={chartUpdateStartTime}
            endTime={chartUpdateEndTime}
            isRunning={chartStatus === 'loading'}
            status={CHART_STATUS_MAP[chartStatus]}
            style={{ fontSize: '10px', marginRight: '5px' }}
          />
          <ExploreActionButtons
            exportToPDF={this.exportToPDF}
            exportedPdf={exportedPdf}
            slice={this.props.slice}
            canDownload={this.props.canDownload}
            chartStatus={chartStatus}
            latestQueryFormData={latestQueryFormData}
            queryResponse={queryResponse}
          />
        </div>
      </div>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

export default ExploreChartHeader;
