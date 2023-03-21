import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import SpeedometerSector from './SpeedometerSector';
import { t } from '../../../locales';
import { getValidationErrorsPositions } from "../../../explore/validators";

const defaultProps = {
    onChange: () => {
    },
    value: [],
};

const defaultSectorValue = {
  description: '',
  from: 0,
  to: 100,
  labelLeft: '',
  labelRight: '',
  color: { r: 0, g: 209, b: 193, a: 1 },
  percentageRange: false,
};

export default class SpeedometerSectorsControl extends React.Component {

    constructor(props) {
        super(props);
        this.handleChangeSector = this.handleChangeSector.bind(this);
        this.addSector = this.addSector.bind(this);
        this.removeSector = this.removeSector.bind(this);
    }

    removeSector(index) {
        const newSectors = Object.assign([], this.props.value);
        newSectors.splice(index, 1);
        this.props.onChange(newSectors);
    }

    addSector() {
        const { value } = this.props;
        // ищем последний сектор с его диаппазонами
        const valueSector = Object.assign({}, defaultSectorValue);
        if (value.length) {
            const lastSector = value[value.length - 1];
            const { to } = lastSector;
            if (to) {
                valueSector.from = parseInt(to, 10);
                valueSector.to = parseInt(to, 10) + 1;
            }
        }
        const newSectors = Object.assign([], value);
        newSectors.push(valueSector);
        this.props.onChange(newSectors);
    }

    handleChangeSector(id, sector) {
        const { onChange, value } = this.props;
        const newValue = value.map((sec, index) => index !== id ? sec : sector);
        onChange(newValue);
    }

    render() {
        const { value, validationErrors, slice, controls } = this.props;
        const maxValueFromResponse = slice?.queryResponse?.data?.data?.[0]?.[0]
        const conditional_formatting_percentage = controls.conditional_formatting_percentage?.value || false
        const validationErrorsPositions = validationErrors.length
        ? getValidationErrorsPositions(value, maxValueFromResponse, conditional_formatting_percentage)
        : [];
        const sectors = value.map((sector, index) => (
          <SpeedometerSector
            leftLabel={index === 0}
            onRemoveSector={() => this.removeSector(index)}
            key={index}
            id={index}
            value={sector}
            errorPositions={validationErrorsPositions[index]}
            onChange={this.handleChangeSector}
          />
        ));
        return (
          <div>
            {sectors}
            <Row className="space-2">
              <Col md={2}>
                <Button
                  bsSize="sm"
                  onClick={this.addSector}
                >
                  <i className="fa fa-plus" /> &nbsp; {t('Add an item')}
                </Button>
              </Col>
            </Row>
          </div>
        );
    }
}

SpeedometerSectorsControl.propTypes = {
    onChange: PropTypes.func,
    value: PropTypes.array,
    slice: PropTypes.object
};
SpeedometerSectorsControl.defaultProps = defaultProps;
