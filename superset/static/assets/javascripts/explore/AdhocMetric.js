export default class AdhocMetric {
  constructor(adhocMetric, commonMetricFormat) {
    this.column = adhocMetric.column;
    this.aggregate = adhocMetric.aggregate;
    this.hasCustomLabel = !!(adhocMetric.hasCustomLabel && adhocMetric.label);
    this.fromFormData = !!adhocMetric.optionName;
    this.customAggregateLabel = adhocMetric.customAggregateLabel || '';
    this.cumulativeTotal = adhocMetric.cumulativeTotal || false;
    this.label = this.replaceBrackets(this.hasCustomLabel ? adhocMetric.label : this.getDefaultLabel());
    this.showPopover = true;
    this.optionName = adhocMetric.optionName ||
      `metric_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
    this.key = Date.now();
    this.customNumberFormat = adhocMetric.customNumberFormat || {
      value: '.3s',
      label: '.3s | 12.3k'
    };
  }

  getDefaultLabel() {
    const { customAggregateLabel, aggregate } = this;
    return `${customAggregateLabel || aggregate || ''}(${(this.column && (this.column.verbose_name || this.column.column_name)) || ''})`;
  }

  duplicateWith(nextFields) {
    return new AdhocMetric({
      ...this,
      ...nextFields,
    });
  }

  equals(adhocMetric) {
    return adhocMetric.label === this.label &&
      adhocMetric.aggregate === this.aggregate &&
      adhocMetric.customNumberFormat.value === this.customNumberFormat.value &&
      (
        (adhocMetric.column && adhocMetric.column.column_name) ===
        (this.column && this.column.column_name)
      );
  }

  replaceBrackets(str) {
    if (str === 'COUNT(*)') return str;
    const newStr = str.replace(/\(/g, '__')
    return newStr.replace(/\)/g, '');
  };

  setShowPopover(state) {
    this.showPopover = !!state;
  }
}
