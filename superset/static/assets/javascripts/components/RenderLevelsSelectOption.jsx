import React from 'react';
import PropTypes from 'prop-types';

const propTypesLevelOption = {
  level: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
};

const propTypesLabelLevel = {
  children: PropTypes.node.isRequired,
};

const LabelLevel = ({ children }) => <span className={'level'}>{children}</span>;
LabelLevel.prototype = propTypesLabelLevel;

const LevelOption = ({ level, label }) => Array.from({ length: level }).reduce(accum => <LabelLevel>{accum}</LabelLevel>, label);

LevelOption.prototype = propTypesLevelOption;

export default LevelOption;
