import React from 'react';
import PropTypes from 'prop-types';
import { Table, Tr, Td, Thead, Th } from 'reactable';
import { isEqual, isEmpty } from 'underscore';

import TooltipWrapper from './TooltipWrapper';
import { controls } from '../explore/stores/controls';
import { visTypes } from '../explore/stores/visTypes';
import ModalTrigger from './ModalTrigger';
import { t } from '../locales';
import { dehumanizeDate } from '../utils/common';

const propTypes = {
  origFormData: PropTypes.object.isRequired,
  currentFormData: PropTypes.object.isRequired,
  origSliceData: PropTypes.object.isRequired,
  currentSliceData: PropTypes.object.isRequired,
};

export default class AlteredSliceTag extends React.Component {
  constructor(props) {
    super(props);
    const diffs = this.getDiffs(props);
    this.state = { diffs, hasDiffs: !isEmpty(diffs) };
  }

  componentWillReceiveProps(newProps) {
    // Update differences if need be
    if (isEqual(this.props, newProps)) {
      return;
    }
    const diffs = this.getDiffs(newProps);
    this.setState({ diffs, hasDiffs: !isEmpty(diffs) });
  }

  processObjectData(data, key) {
    if (Array.isArray(data)) {
      return data.length
        ? data.map((item) => (item instanceof Object ? item[key] : item)).join(', ')
        : [];
    } else if (typeof data === 'object') {
      return data[key];
    } else {
      return data;
    }
  }

  getDiffs(props) {
    // Returns all properties that differ in the
    // current form data and the saved form data
    const ofd = { ...props.origFormData, ...props.origSliceData };
    const cfd = { ...props.currentFormData, ...props.currentSliceData };
    const fdKeys = Object.keys(cfd);
    const diffs = {};
    for (const fdKey of fdKeys) {
      // Ignore values that are undefined/nonexisting in either
      if (!ofd[fdKey] && !cfd[fdKey]) {
        continue;
      }
      if (!isEqual(ofd[fdKey], cfd[fdKey])) {
        let objectDataKeys = {
          metric: 'label',
          metrics: 'label',
          url_drilldowns: 'title',
        };

        if (objectDataKeys.hasOwnProperty(fdKey)) {
          diffs[fdKey] = {
            before: this.processObjectData(ofd[fdKey], objectDataKeys[fdKey]),
            after: this.processObjectData(cfd[fdKey], objectDataKeys[fdKey]),
          };
        } else {
          diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
        }
      }
    }

    delete diffs?.isExploreCharts;
    return diffs;
  }

  formatValue(value, key) {
    // Format display value based on the control type
    // or the value type
    if (value === undefined) {
      return '-';
    } else if (value === null) {
      return '-';
    } else if (key === 'viz_type') {
      return visTypes[value] ? visTypes[value].label : value;
    } else if (
      controls[key] &&
      (controls[key].type === 'FilterControl' || controls[key].type === 'FilterWithGroupControl')
    ) {
      if (!value.length) {
        return '[]';
      }
      return value
        .map((v) => {
          if ('val' in v) {
            const filterVal = v.val.constructor === Array ? `[${v.val.join(', ')}]` : v.val;
            return `${v.col} ${v.op} ${filterVal}`;
          }
        })
        .join(', ');
    } else if (controls[key] && controls[key].type === 'BoundsControl') {
      return `${t('Min')}: ${value[0]}, ${t('Max')}: ${value[1]}`;
    } else if (controls[key] && controls[key].type === 'CollectionControl') {
      return value.map((v) => JSON.stringify(v)).join(', ');
    } else if (typeof value === 'boolean') {
      return t(`${value}`);
    } else if (value.constructor === Array) {
      return value.length ? value.join(', ') : '[]';
    } else if (typeof value === 'string' || typeof value === 'number') {
      if (typeof value === 'string') {
        if (key === 'x_axis_format' && value === 'smart_date') {
          value = t('Adaptative formating');
        } else if (key === 'pie_label_type' && value === 'key') {
          value = t('Category Name');
        } else {
          value = t(value);
        }
      }
      return dehumanizeDate(value);
    }
    return JSON.stringify(value);
  }

  renderRows() {
    const diffs = this.state.diffs;
    const rows = [];
    for (const key in diffs) {
      rows.push(
        <Tr key={key}>
          <Td column='control' data={(controls[key] && controls[key].label) || key} />
          <Td column='before'>{this.formatValue(diffs[key].before, key)}</Td>
          <Td column='after'>{this.formatValue(diffs[key].after, key)}</Td>
        </Tr>
      );
    }
    return rows;
  }

  renderModalBody() {
    return (
      <Table className='table' sortable>
        <Thead>
          <Th column='control'>{t('Control')}</Th>
          <Th column='before'>{t('Before')}</Th>
          <Th column='after'>{t('After')}</Th>
        </Thead>
        {this.renderRows()}
      </Table>
    );
  }

  renderTriggerNode() {
    return (
      <TooltipWrapper label='difference' tooltip={t('Click to see difference')}>
        <span className='label label-warning m-l-5' style={{ fontSize: '12px' }}>
          {t('Altered')}
        </span>
      </TooltipWrapper>
    );
  }

  render() {
    // Return nothing if there are no differences
    if (!this.state.hasDiffs) {
      return null;
    }
    // Render the label-warning 'Altered' tag which the user may
    // click to open a modal containing a table summarizing the
    // differences in the slice
    return (
      <ModalTrigger
        animation
        triggerNode={this.renderTriggerNode()}
        modalTitle={t('Slice changes')}
        bsSize='large'
        modalBody={this.renderModalBody()}
      />
    );
  }
}

AlteredSliceTag.propTypes = propTypes;
