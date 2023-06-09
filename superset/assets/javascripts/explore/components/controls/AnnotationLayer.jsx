import React from 'react';
import PropTypes from 'prop-types';
import { CompactPicker } from 'react-color';
import { Button } from 'react-bootstrap';

import $ from 'jquery';
import mathjs from 'mathjs';

import SelectControl from './SelectControl';
import TextControl from './TextControl';
import CheckboxControl from './CheckboxControl';

import AnnotationTypes, {
  DEFAULT_ANNOTATION_TYPE,
  ANNOTATION_SOURCE_TYPES,
  getAnnotationSourceTypeLabels,
  getAnnotationTypeLabel,
  getSupportedSourceTypes,
  getSupportedAnnotationTypes,
  requiresQuery,
} from '../../../modules/AnnotationTypes';

import { ALL_COLOR_SCHEMES } from '../../../modules/colors';
import PopoverSection from '../../../components/PopoverSection';
import ControlHeader from '../ControlHeader';
import { nonEmpty } from '../../validators';
import vizTypes from '../../stores/visTypes';
import { t } from '../../../locales';

const AUTOMATIC_COLOR = '';

const propTypes = {
  name: PropTypes.string,
  annotationType: PropTypes.string,
  sourceType: PropTypes.string,
  color: PropTypes.string,
  opacity: PropTypes.string,
  style: PropTypes.string,
  width: PropTypes.number,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  overrides: PropTypes.object,
  show: PropTypes.bool,
  titleColumn: PropTypes.string,
  descriptionColumns: PropTypes.arrayOf(PropTypes.string),
  timeColumn: PropTypes.string,
  intervalEndColumn: PropTypes.string,
  vizType: PropTypes.string,

  error: PropTypes.string,
  colorScheme: PropTypes.string,

  addAnnotationLayer: PropTypes.func,
  removeAnnotationLayer: PropTypes.func,
  close: PropTypes.func,
};

const defaultProps = {
  name: '',
  annotationType: DEFAULT_ANNOTATION_TYPE,
  sourceType: '',
  color: AUTOMATIC_COLOR,
  opacity: '',
  style: 'solid',
  width: 1,
  overrides: {},
  colorScheme: 'd3Category10',
  show: true,
  titleColumn: '',
  descriptionColumns: [],
  timeColumn: '',
  intervalEndColumn: '',

  addAnnotationLayer: () => {},
  removeAnnotationLayer: () => {},
  close: () => {},
};

export default class AnnotationLayer extends React.PureComponent {
  constructor(props) {
    super(props);
    const { name, annotationType, sourceType,
      color, opacity, style, width, value,
      overrides, show, titleColumn, descriptionColumns,
      timeColumn, intervalEndColumn } = props;
    this.state = {
      // base
      name,
      oldName: !this.props.name ? null : name,
      annotationType,
      sourceType,
      value,
      overrides,
      show,
      // slice
      titleColumn,
      descriptionColumns,
      timeColumn,
      intervalEndColumn,
      // display
      color: color || AUTOMATIC_COLOR,
      opacity,
      style,
      width,
      // refData
      isNew: !this.props.name,
      isLoadingOptions: true,
      valueOptions: [],
      validationErrors: {},
    };
    this.submitAnnotation = this.submitAnnotation.bind(this);
    this.deleteAnnotation = this.deleteAnnotation.bind(this);
    this.applyAnnotation = this.applyAnnotation.bind(this);
    this.fetchOptions = this.fetchOptions.bind(this);
    this.handleAnnotationType = this.handleAnnotationType.bind(this);
    this.handleAnnotationSourceType =
        this.handleAnnotationSourceType.bind(this);
    this.handleValue = this.handleValue.bind(this);
    this.isValidForm = this.isValidForm.bind(this);
  }

  componentDidMount() {
    const { annotationType, sourceType, isLoadingOptions } = this.state;
    this.fetchOptions(annotationType, sourceType, isLoadingOptions);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.sourceType !== this.state.sourceType) {
      this.fetchOptions(this.state.annotationType, this.state.sourceType, true);
    }
  }

  isValidFormula(value, annotationType) {
    if (annotationType === AnnotationTypes.FORMULA) {
      try {
        mathjs.parse(value).compile().eval({ x: 0 });
      } catch (err) {
        return true;
      }
    }
    return false;
  }

  isValidForm() {
    const {
      name, annotationType, sourceType,
      value, timeColumn, intervalEndColumn,
    } = this.state;
    const errors = [nonEmpty(name), nonEmpty(annotationType), nonEmpty(value)];
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE) {
      if (annotationType === AnnotationTypes.EVENT) {
        errors.push(nonEmpty(timeColumn));
      }
      if (annotationType === AnnotationTypes.INTERVAL) {
        errors.push(nonEmpty(timeColumn));
        errors.push(nonEmpty(intervalEndColumn));
      }
    }
    errors.push(this.isValidFormula(value, annotationType));
    return !errors.filter(x => x).length;
  }


  handleAnnotationType(annotationType) {
    this.setState({
      annotationType,
      sourceType: null,
      validationErrors: {},
      value: null,
    });
  }

  handleAnnotationSourceType(sourceType) {
    this.setState({
      sourceType,
      isLoadingOptions: true,
      validationErrors: {},
      value: null,
    });
  }

  handleValue(value) {
    this.setState({
      value,
      descriptionColumns: null,
      intervalEndColumn: null,
      timeColumn: null,
      titleColumn: null,
      overrides: { since: null, until: null },
    });
  }

  fetchOptions(annotationType, sourceType, isLoadingOptions) {
    if (isLoadingOptions === true) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        $.ajax({
          type: 'GET',
          url: '/annotationlayermodelview/api/read?',
        }).then((data) => {
          const layers = data ? data.result.map(layer => ({
            value: layer.id,
            label: layer.name,
          })) : [];
          this.setState({
            isLoadingOptions: false,
            valueOptions: layers,
          });
        });
      } else if (requiresQuery(sourceType)) {
        $.ajax({
          type: 'GET',
          url: '/superset/user_slices',
        }).then(data =>
          this.setState({
            isLoadingOptions: false,
            valueOptions: data.filter(
                x => getSupportedSourceTypes(annotationType)
                .find(v => v === x.viz_type))
                .map(x => ({ value: x.id, label: x.title, slice: x }),
              ),
          }),
        );
      } else {
        this.setState({
          isLoadingOptions: false,
          valueOptions: [],
        });
      }
    }
  }

  deleteAnnotation() {
    this.props.close();
    if (!this.state.isNew) {
      this.props.removeAnnotationLayer(this.state);
    }
  }

  applyAnnotation() {
    if (this.state.name.length) {
      const annotation = {};
      Object.keys(this.state).forEach((k) => {
        if (this.state[k] !== null) {
          annotation[k] = this.state[k];
        }
      });
      delete annotation.isNew;
      delete annotation.valueOptions;
      delete annotation.isLoadingOptions;
      delete annotation.validationErrors;
      annotation.color = annotation.color === AUTOMATIC_COLOR ? null : annotation.color;
      this.props.addAnnotationLayer(annotation);
      this.setState({ isNew: false, oldName: this.state.name });
    }
  }

  submitAnnotation() {
    this.applyAnnotation();
    this.props.close();
  }

  renderValueConfiguration() {
    const { annotationType, sourceType, value,
      valueOptions, isLoadingOptions } = this.state;
    let label = '';
    let description = '';
    if (requiresQuery(sourceType)) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        label = t('Annotation Layer');
        description = t('Select the Annotation Layer you would like to use.');
      } else {
        label = t('Slice');
        description = `${t('Use a pre defined Superset Slice as a source for annotations and overlays.')}
        ${t('your Slice must be one of these visualization types: [%s]', getSupportedSourceTypes(sourceType).map(x => vizTypes[x].label).join(', '))}`;
      }
    } else if (annotationType === AnnotationTypes.FORMULA) {
      label = t('Formula');
      description = t(`Expects a formula with depending time parameter 'x' in milliseconds since epoch. mathjs is used to evaluate the formulas. Example: '2x+5'`);
    }
    if (requiresQuery(sourceType)) {
      return (
        <SelectControl
          name="annotation-layer-value"
          showHeader
          hovered
          description={description}
          label={label}
          placeholder=""
          options={valueOptions}
          isLoading={isLoadingOptions}
          value={value}
          onChange={this.handleValue}
          validationErrors={!value ? [t('Mandatory')] : []}
        />
      );
    } if (annotationType === AnnotationTypes.FORMULA) {
      return (
        <TextControl
          name="annotation-layer-value"
          hovered
          showHeader
          description={description}
          label={label}
          placeholder=""
          value={value}
          onChange={this.handleValue}
          validationErrors={this.isValidFormula(value, annotationType) ? [t('Bad formula.')] : []}
        />
      );
    }
    return '';
  }

  renderSliceConfiguration() {
    const { annotationType, sourceType, value, valueOptions, overrides, titleColumn,
      timeColumn, intervalEndColumn, descriptionColumns } = this.state;
    const slice = (valueOptions.find(x => x.value === value) || {}).slice;
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE && slice) {
      const columns = (slice.data.groupby || []).concat(
        (slice.data.all_columns || [])).map(x => ({ value: x, label: x }));
      const timeColumnOptions = slice.data.include_time ?
        [{ value: '__timestamp', label: '__timestamp' }].concat(columns) : columns;
      return (
        <div style={{ marginRight: '2rem' }}>
          <PopoverSection
            isSelected
            onSelect={() => {
            }}
            title={t('Annotation Slice Configuration')}
            info={t('This section allows you to configure how to use the slice to generate annotations.')}
          >
            {
              (
                annotationType === AnnotationTypes.EVENT ||
                annotationType === AnnotationTypes.INTERVAL
              ) &&
              <SelectControl
                hovered
                name="annotation-layer-time-column"
                label={
                  annotationType === AnnotationTypes.INTERVAL ?
                    t('Interval Start column') : t('Event Time Column')
                }
                description={t('This column must contain date/time information.')}
                validationErrors={!timeColumn ? [t('Mandatory')] : []}
                clearable={false}
                options={timeColumnOptions}
                value={timeColumn}
                onChange={v => this.setState({ timeColumn: v })}
              />
            }
            {
              annotationType === AnnotationTypes.INTERVAL &&
              <SelectControl
                hovered
                name="annotation-layer-intervalEnd"
                label={t('Interval End column')}
                description={t('This column must contain date/time information.')}
                validationErrors={!intervalEndColumn ? [t('Mandatory')] : []}
                options={columns}
                value={intervalEndColumn}
                onChange={v => this.setState({ intervalEndColumn: v })}
              />
            }
            <SelectControl
              hovered
              name="annotation-layer-title"
              label={t('Title Column')}
              description={t('Pick a title for you annotation.')}
              options={
                [{ value: '', label: t('None') }].concat(columns)
              }
              value={titleColumn}
              onChange={v => this.setState({ titleColumn: v })}
            />
            {
              annotationType !== AnnotationTypes.TIME_SERIES &&
              <SelectControl
                hovered
                name="annotation-layer-title"
                label={t('Description Columns')}
                description={t(`Pick one or more columns that should be shown in the annotation. If you don't select a column all of them will be shown.`)}
                multi
                options={
                  columns
                }
                value={descriptionColumns}
                onChange={v => this.setState({ descriptionColumns: v })}
              />
            }
            <div style={{ marginTop: '1rem' }}>
              <CheckboxControl
                hovered
                name="annotation-override-since"
                label={t(`Override 'Since'`)}
                description={t(`This controls whether the 'Since' field from the current view should be passed down to the slice containing the annotation data.`)}
                value={!!Object.keys(overrides).find(x => x === 'since')}
                onChange={(v) => {
                  delete overrides.since;
                  if (v) {
                    this.setState({ overrides: { ...overrides, since: null } });
                  } else {
                    this.setState({ overrides: { ...overrides } });
                  }
                }}
              />
              <CheckboxControl
                hovered
                name="annotation-override-until"
                label={t(`Override 'Until'`)}
                description={t(`This controls whether the 'Until' field from the current view should be passed down to the slice containing the annotation data.`)}
                value={!!Object.keys(overrides).find(x => x === 'until')}
                onChange={(v) => {
                  delete overrides.until;
                  if (v) {
                    this.setState({ overrides: { ...overrides, until: null } });
                  } else {
                    this.setState({ overrides: { ...overrides } });
                  }
                }}
              />
              <TextControl
                hovered
                name="annotation-layer-timeshift"
                label={t('Time Shift')}
                description={t(`Time delta in natural language (example:  24 hours, 7 days, 56 weeks, 365 days)`)}
                placeholder=""
                value={overrides.time_shift}
                onChange={v => this.setState({ overrides: { ...overrides, time_shift: v } })}
              />
            </div>
          </PopoverSection>
        </div>
      );
    }
    return ('');
  }

  renderDisplayConfiguration() {
    const { color, opacity, style, width } = this.state;
    const colorScheme = [...ALL_COLOR_SCHEMES[this.props.colorScheme]];
    if (color && color !== AUTOMATIC_COLOR &&
      !colorScheme.find(x => x.toLowerCase() === color.toLowerCase())) {
      colorScheme.push(color);
    }
    return (
      <PopoverSection
        isSelected
        onSelect={() => {}}
        title={t('Display configuration')}
        info={t('Configure your how you overlay is displayed here.')}
      >
        <SelectControl
          name="annotation-layer-stroke"
          label={t('Style')}
            // see '../../../../visualizations/nvd3_vis.css'
          options={[
              { value: 'solid', label: t('Solid') },
              { value: 'dashed', label: t('Dashed') },
              { value: 'longDashed', label: t('Long Dashed') },
              { value: 'dotted', label: t('Dotted') },
          ]}
          value={style}
          onChange={v => this.setState({ style: v })}
        />
        <SelectControl
          name="annotation-layer-opacity"
          label={t('Opacity')}
            // see '../../../../visualizations/nvd3_vis.css'
          options={[
              { value: '', label: t('Solid') },
              { value: 'opacityLow', label: '0.2' },
              { value: 'opacityMedium', label: '0.5' },
              { value: 'opacityHigh', label: '0.8' },
          ]}
          value={opacity}
          onChange={v => this.setState({ opacity: v })}
        />
        <div>
          <ControlHeader label={t('Color')} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CompactPicker
              color={color}
              colors={colorScheme}
              onChangeComplete={v => this.setState({ color: v.hex })}
            />
            <Button
              style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}
              bsStyle={color === AUTOMATIC_COLOR ? 'success' : 'default'}
              bsSize="xsmall"
              onClick={() => this.setState({ color: AUTOMATIC_COLOR })}
            >
              {t('Automatic Color')}
            </Button>
          </div>
        </div>
        <TextControl
          name="annotation-layer-stroke-width"
          label={t('Line Width')}
          isInt
          value={width}
          onChange={v => this.setState({ width: v })}
        />
      </PopoverSection>
    );
  }

  render() {
    const { isNew, name, annotationType,
      sourceType, show } = this.state;
    const isValid = this.isValidForm();
    return (
      <div>
        {
          this.props.error &&
          <span style={{ color: 'red' }}>
            ERROR: {this.props.error}
          </span>
        }
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ marginRight: '2rem' }}>
            <PopoverSection
              isSelected
              onSelect={() => {}}
              title={t('Layer Configuration')}
              info={t('Configure the basics of your Annotation Layer.')}
            >
              <TextControl
                name="annotation-layer-name"
                label={t('Name')}
                placeholder=""
                value={name}
                onChange={v => this.setState({ name: v })}
                validationErrors={!name ? [t('Mandatory')] : []}
              />
              <CheckboxControl
                name="annotation-layer-hide"
                label={t('Hide Layer')}
                value={!show}
                onChange={v => this.setState({ show: !v })}
              />
              <SelectControl
                hovered
                description={t('Choose the Annotation Layer Type')}
                label={t('Annotation Layer Type')}
                name="annotation-layer-type"
                options={getSupportedAnnotationTypes(this.props.vizType).map(
                    x => ({ value: x, label: getAnnotationTypeLabel(x) }))}
                value={annotationType}
                onChange={this.handleAnnotationType}
              />
              {!!getSupportedSourceTypes(annotationType).length &&
                <SelectControl
                  hovered
                  description={t('Choose the source of your annotations')}
                  label={t('Annotation Source')}
                  name="annotation-source-type"
                  options={getSupportedSourceTypes(annotationType).map(
                        x => ({ value: x, label: getAnnotationSourceTypeLabels(x) }))}
                  value={sourceType}
                  onChange={this.handleAnnotationSourceType}
                />
              }
              { this.renderValueConfiguration() }
            </PopoverSection>
          </div>
          { this.renderSliceConfiguration() }
          { this.renderDisplayConfiguration() }
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            bsSize="sm"
            onClick={this.deleteAnnotation}
          >
            { !isNew ? t('Remove') : t('Cancel') }
          </Button>
          <div>
            <Button
              bsSize="sm"
              disabled={!isValid}
              onClick={this.applyAnnotation}
            >
              {t('Apply')}
            </Button>

            <Button
              bsSize="sm"
              disabled={!isValid}
              onClick={this.submitAnnotation}
            >
              {t('OK')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
AnnotationLayer.propTypes = propTypes;
AnnotationLayer.defaultProps = defaultProps;
