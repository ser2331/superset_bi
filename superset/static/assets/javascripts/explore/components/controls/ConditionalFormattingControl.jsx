import React from "react";
import PropTypes from "prop-types";
import { Button, Row, Col } from "react-bootstrap";
import ConditionalFormattingSector, {
  defaultValue as defaultValueSector,
} from "./ConditionalFormattingSector";
import { t } from "../../../locales";
import { getValidationErrorsPositions } from "../../../explore/validators";
import { getMaxOfRecords } from "../../../../visualizations/table";
import { getMinMaxLineChartValuesY } from "../../../../visualizations/nvd3_vis";
import { getMaxValuePivotTabe } from  '../../../../visualizations/pivot_table'

const defaultProps = {
  onChange: () => {},
  value: [],
};

const defaultSectorData = {
  common: {
    description: "",
    from: 0,
    to: 100,
    color: { r: 0, g: 209, b: 193, a: 1 },
  },
  withLabelsUpDown: {
    labelDown: "",
    labelUp: "",
  },
};

const getDefaultSector = (vizType) => {
  switch (vizType) {
    case "line":
      return {
        ...defaultSectorData.common,
        ...defaultSectorData.withLabelsUpDown,
      };
    default:
      return {
        ...defaultSectorData.common,
      };
  }
};

export default class ConditionalFormattingControl extends React.Component {
  removeSector = (index) => {
    const newSectors = [...this.props.value];
    newSectors.splice(index, 1);
    this.props.onChange(newSectors);
  };

  addSector = () => {
    const { value, vizType } = this.props;
    const defaultSector = getDefaultSector(vizType);
    if (value.length) {
      const lastSector = value[value.length - 1];
      const { to } = lastSector;
      if (to) {
        defaultSector.from = parseInt(to, 10);
        defaultSector.to = parseInt(to, 10) + 1;
      }
    }
    const newSectors = [...value];
    newSectors.push(defaultSector);
    this.props.onChange(newSectors);
  };

  handleChangeSector = (id, sector) => {
    const { onChange, value } = this.props;
    const newValue = value.map((sec, index) => (index !== id ? sec : sector));
    onChange(newValue);
  };

  render() {
    const { value, validationErrors, vizType, slice, controls } = this.props;
    const showLabelsDownUp = vizType === "line";
    const showLegendInStyles = vizType === 'pivot_table';
    const conditional_formatting_percentage = controls.conditional_formatting_percentage?.value || false
    let maxValueFromResponse
    if (vizType === 'table') {
      const records = slice?.queryResponse?.data?.records
      maxValueFromResponse = records ? getMaxOfRecords(records) : 0
    }
    if (vizType === 'line') {
      let data = slice?.queryResponse?.data
      data = Array.isArray(data) ? data : []
      const minMaxLineChartValuesY = getMinMaxLineChartValuesY(data)
      maxValueFromResponse = minMaxLineChartValuesY?.max || 0
    }
    if (vizType === 'pivot_table')  {
      const max = getMaxValuePivotTabe(slice?.queryResponse?.data?.html);
      maxValueFromResponse = max || 0;
    }

    const validationErrorsPositions = validationErrors.length
      ? getValidationErrorsPositions(value, maxValueFromResponse, conditional_formatting_percentage)
      : [];
    const sectors = value.map((sector, index) => (
      <ConditionalFormattingSector
        onRemoveSector={() => this.removeSector(index)}
        key={index}
        id={index}
        value={sector}
        onChange={this.handleChangeSector}
        errorPositions={validationErrorsPositions[index]}
        showLabelsDownUp={showLabelsDownUp}
      />
    ));
    return (
      <div>
        {sectors}
        <Row className="space-2">
          <Col md={2}>
            <Button bsSize="sm" onClick={this.addSector}>
              <i className="fa fa-plus" /> &nbsp; {t("Add an item")}
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

ConditionalFormattingControl.propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.array,
  vizType: PropTypes.string,
};
ConditionalFormattingControl.defaultProps = defaultProps;
