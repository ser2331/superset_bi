import React from "react";
import PropTypes from "prop-types";
import { Button, ControlLabel, FormGroup, Popover } from "react-bootstrap";
import { Creatable as CreatableSelect } from "react-select";

import { numberFormatOptions } from "./AdhocMetricEditPopover";
import { t, tn } from "../../locales";

const propTypes = {
  specificMetricFormatValue: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  metricName: PropTypes.string,
  commonMetricFormatValue: PropTypes.string,
};

const getSpecificMetricFormat = (value, label) => {
  const knownFormatObject = numberFormatOptions.find(option => option.value === value)
  if (knownFormatObject) {
    return { value: knownFormatObject.value, label: knownFormatObject.label }
  }
  return value ? { value, label: label || value } : null;
}

export default class EditSavedMetricPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onNumberFormatChange = this.onNumberFormatChange.bind(this);
    this.state = { specificMetricFormat: undefined };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.specificMetricFormatValue) {
      this.setState({
        ...this.state,
        specificMetricFormat: getSpecificMetricFormat(
          nextProps.specificMetricFormatValue
        ),
      });
    }
  }

  onSave() {
    const value =
      this.state.specificMetricFormat === null ? '' :
      (this.state.specificMetricFormat?.value ||
      this.props.specificMetricFormatValue)
    this.props.onChange({name: this.props.metricName, value});
    this.props.onClose();
  }

  onNumberFormatChange(newValue) {
    this.setState({
      ...this.state,
      specificMetricFormat: getSpecificMetricFormat(
        newValue?.value || "",
        newValue?.label || ""
      ),
    });
  }

  render() {
    const {
      onChange,
      onClose,
      specificMetricFormatValue,
      commonMetricFormatValue,
      dataMetricFormat,
      metricName,
      ...popoverProps
    } = this.props;

    let value
   if (this.state.specificMetricFormat === undefined && specificMetricFormatValue === null) {
      value = dataMetricFormat || getSpecificMetricFormat(commonMetricFormatValue)  || numberFormatOptions[1]
    } else if (this.state?.specificMetricFormat?.value) {
      value = this.state.specificMetricFormat
    } else if (this.state.specificMetricFormat === null || specificMetricFormatValue === '') {
      value = ''
    } else {
      value = getSpecificMetricFormat(specificMetricFormatValue) ||
      dataMetricFormat ||
      getSpecificMetricFormat(commonMetricFormatValue) ||
      numberFormatOptions[1]
    }

    const numberFormatSelectProps = {
      placeholder: t("Number format"),
      value,
      options: numberFormatOptions,
      onChange: this.onNumberFormatChange,
    };

    return (
      <Popover id="metric-saved-popover" {...popoverProps}>
        <FormGroup>
          <ControlLabel>
            <strong>{t("Number format")}</strong>
          </ControlLabel>
          <CreatableSelect {...numberFormatSelectProps} isClearable/>
        </FormGroup>
        <Button
          bsStyle={"primary"}
          bsSize="small"
          className="m-r-5"
          onClick={this.onSave}
        >
          {t("Save")}
        </Button>
        <Button bsSize="small" onClick={this.onSave}>
          {t("Close")}
        </Button>
      </Popover>
    );
  }
}

EditSavedMetricPopover.propTypes = propTypes;
