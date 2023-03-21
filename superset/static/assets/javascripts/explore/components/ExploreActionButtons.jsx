import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import URLShortLinkButton from './URLShortLinkButton';
import EmbedCodeButton from './EmbedCodeButton';
import DisplayQueryButton from './DisplayQueryButton';
import { t } from '../../locales';
import { exportChart } from '../exploreUtils';
import { STATUS_RENDERED } from './ExploreChartHeader';

const propTypes = {
  canDownload: PropTypes.bool.isRequired,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object,
  queryResponse: PropTypes.object,
  exportToPDF: PropTypes.func,
  exportedPdf: PropTypes.bool,
};

export default function ExploreActionButtons({
  canDownload,
  chartStatus,
  latestQueryFormData,
  queryResponse,
  exportToPDF,
  exportedPdf,
}) {
  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    'disabled disabledButton': !canDownload,
  });
  const doExportCSV = exportChart.bind(this, latestQueryFormData, 'csv');
  const doExportChart = exportChart.bind(this, latestQueryFormData, 'json');
  const doExportExcel = exportChart.bind(this, latestQueryFormData, 'excel');

  return (
    <div className='btn-group results' role='group'>
      {latestQueryFormData && (
        <URLShortLinkButton latestQueryFormData={latestQueryFormData} />
      )}

      {latestQueryFormData && (
        <EmbedCodeButton latestQueryFormData={latestQueryFormData} />
      )}

      {canDownload && latestQueryFormData && (
        <a
          onClick={doExportChart}
          className='btn btn-default btn-sm'
          title={t('Export to .json')}
          target='_blank'
          rel='noopener noreferrer'
        >
          <i className='fa fa-file-code-o' /> .json
        </a>
      )}
      {canDownload && latestQueryFormData && (
        <a
          onClick={doExportExcel}
          className='btn btn-default btn-sm'
          title={t('Export to .xls format')}
          target='_blank'
          rel='noopener noreferrer'
        >
          <i className='fa fa-file-excel-o' /> .xls
        </a>
      )}
      {canDownload && latestQueryFormData && (
        <a
          onClick={doExportCSV}
          className={exportToCSVClasses}
          title={t('Export to .csv format')}
          target='_blank'
          rel='noopener noreferrer'
        >
          <i className='fa fa-file-text-o' /> .csv
        </a>
      )}
      {canDownload && latestQueryFormData && (
        <a
          onClick={exportToPDF}
          className={
            exportToCSVClasses +
            (chartStatus !== STATUS_RENDERED || exportedPdf ? ' disabled' : '')
          }
          title={t('Export PDF')}
          target='_blank'
          rel='noopener noreferrer'
        >
          <i className='fa fa-file-pdf-o' /> .pdf
        </a>
      )}
      <DisplayQueryButton
        queryResponse={queryResponse}
        latestQueryFormData={latestQueryFormData}
        chartStatus={chartStatus}
      />
    </div>
  );
}

ExploreActionButtons.propTypes = propTypes;
