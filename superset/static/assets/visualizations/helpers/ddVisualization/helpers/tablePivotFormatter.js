export const tablePivotFormatterCombineMetric = (slice, payload, i, replacedMetricsName, metricFullName) => {
  let metricShortName = "";

  slice.metrics &&
  slice.metrics.forEach((metric) => {
    metric.verbose_name === metricFullName && (metricShortName = metric.metric_name);
  });
  const appropriateMetricOnTheFly = slice.formData?.metrics?.find(
    (metric) => typeof metric !== "string" && metric?.label === metricFullName
  );
  let formatOnTheFly;
  if (appropriateMetricOnTheFly) {
    formatOnTheFly = appropriateMetricOnTheFly.customNumberFormat?.value;
  }
  const commonMetricFormat = slice.formData?.number_format;
  const column_formatsPayload = { ...payload?.form_data?.column_format };
  const column_formatsSlice = { ...slice.datasource.column_formats };
  const column_formatsCurrent = { ...slice.datasource.column_format };
  const column_formats = { ...slice.datasource.column_formats, ...payload?.form_data?.column_format };

  const defaultMetricFormat =
    slice.datasource.column_formats && Object.keys(slice.datasource.column_formats).length !== 0
      ? slice.datasource.column_formats[metricFullName] ||
      slice.datasource.column_formats?.[replacedMetricsName[metricFullName]] ||
      slice.datasource.column_formats?.[metricFullName?.slice(1)] ||
      slice.datasource.column_formats?.[metricShortName]
      : commonMetricFormat || ".3s";

  const backFormat =
    Object.keys(column_formatsPayload).length !== 0 &&
    (column_formatsPayload[metricShortName] ||
      column_formatsPayload[metricFullName] ||
      column_formatsPayload?.[replacedMetricsName[metricFullName]] ||
      column_formatsPayload[metricFullName?.slice(1)]);
  const sliceFormat =
    Object.keys(column_formatsSlice).length !== 0 &&
    (column_formatsSlice[metricShortName] ||
      column_formatsSlice[metricFullName] ||
      column_formatsSlice?.[replacedMetricsName[metricFullName]] ||
      column_formatsSlice[metricFullName?.slice(1)]);

  let currentFormat =
    Object.keys(column_formatsCurrent).length !== 0 &&
    (column_formatsCurrent[metricShortName] ||
      column_formatsCurrent[metricFullName] ||
      column_formatsCurrent?.[replacedMetricsName[metricFullName]] ||
      column_formatsCurrent[metricFullName?.slice(1)]);

  let format = formatOnTheFly || currentFormat || backFormat || sliceFormat || defaultMetricFormat;

  if(metricFullName in column_formatsCurrent &&
    !column_formatsCurrent[metricFullName]) {
    format = commonMetricFormat
  }
  if(metricFullName in column_formatsPayload && !column_formatsPayload[metricFullName]) {
    format = commonMetricFormat

    if(column_formatsCurrent[metricFullName]) {
      format = currentFormat
    }
  }
  const metricHasEmptyValue =
    (Object.keys(column_formats).length !== 0 &&
      (column_formats[metricFullName] === "" ||
        column_formats[metricShortName] === "" ||
        column_formats?.[replacedMetricsName[metricFullName]] === "")) ||
    formatOnTheFly === "";

  if (metricHasEmptyValue) {
    format = commonMetricFormat;
  }

  return currentFormat || format || commonMetricFormat;
};
