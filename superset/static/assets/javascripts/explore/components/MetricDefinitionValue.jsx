import React from "react";
import PropTypes from "prop-types";

import AdhocMetricOption from "./AdhocMetricOption";
import AdhocMetric from "../AdhocMetric";
import columnType from "../propTypes/columnType";
import MetricSavedOption from "../../components/MetricSavedOption";
import MetricOption from "../../components/MetricOption";
import savedMetricType from "../propTypes/savedMetricType";
import adhocMetricType from "../propTypes/adhocMetricType";
import { t } from "../../locales";

const propTypes = {
  option: PropTypes.oneOfType([savedMetricType, adhocMetricType]).isRequired,
  onMetricEdit: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
  Popover: PropTypes.func,
  vizType: PropTypes.string.isRequired,
};

export default function MetricDefinitionValue({
  option,
  onMetricEdit,
  columns,
  multi,
  datasourceType,
  Popover,
  vizType,
}) {
  if (option.metric_name) {
    if (vizType === "table" || vizType === "pivot_table") {
      return <MetricSavedOption metric={option} />
    } else {
      return <MetricOption metric={option} vizType={vizType} />
    }
  } else if (option instanceof AdhocMetric) {
    return (
      <AdhocMetricOption
        adhocMetric={option}
        onMetricEdit={onMetricEdit}
        columns={columns}
        multi={multi}
        datasourceType={datasourceType}
        Popover={Popover}
        vizType={vizType}
      />
    );
  }
  notify.error(
    t(
      "You must supply either a saved metric or adhoc metric to MetricDefinitionValue"
    )
  );
  return null;
}
MetricDefinitionValue.propTypes = propTypes;
