/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { Button, FormControl, FormGroup, Radio } from 'react-bootstrap';
import { getAjaxErrorMsg } from '../../modules/utils';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import Checkbox from '../../components/Checkbox';

import RenderLevelsSelectOption from '../../components/RenderLevelsSelectOption';

const $ = window.$ = require('jquery');

const propTypes = {
  css: PropTypes.string,
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
  filters: PropTypes.object.isRequired,
  serialize: PropTypes.func,
  onSave: PropTypes.func,
};

class SaveModal extends React.PureComponent {
  constructor(props) {
    super(props);
    const { dashboard } = props;
    this.state = {
      dashboard: props.dashboard,
      css: props.css,
      saveType: 'overwrite',
      newDashName: props.dashboard.dashboard_title + ` [${t('copy')}]`,
      duplicateSlices: false,
      folders: [],
      saveToFolderId: dashboard?.folder_id ?? '',
    };
    this.modal = null;
    this.handleSaveTypeChange = this.handleSaveTypeChange.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.saveDashboard = this.saveDashboard.bind(this);
    this.onChangeFolder = this.onChangeFolder.bind(this);
  }

  componentDidMount() {
    this.fetchDashboardsFolders();
  }
  onChangeFolder({ value }) {
    this.setState({ saveToFolderId: value });
  }
  fetchDashboardsFolders() {
    const url = '/superset/folders/dashboard/';
    $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        const folderDate = data.filter(item => item.id !== '#-#').sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });
        const folderTree = (folders, parent = null, level = 0) =>
            folders.reduce((tree, currentItem) => {
                  if (currentItem.parent_id === parent) {
                    const options = folderTree(folders, currentItem.id, level + 1);
                    if (options.length) {
                      tree.push({ value: currentItem.id, label: currentItem.name, level });
                      options.forEach((option) => {
                        tree.push(option);
                      });
                    } else {
                      tree.push({ value: currentItem.id, label: currentItem.name, level });
                    }
                  }
                  return tree;
                },
                [],
        );
        this.setState({ folders: folderTree(folderDate) });
      },
      error: () => {
        this.setState({ folders: [] });
      },
    });
  }

  toggleDuplicateSlices() {
    this.setState({ duplicateSlices: !this.state.duplicateSlices });
  }
  handleSaveTypeChange(event) {
    this.setState({
      saveType: event.target.value,
    });
  }
  handleNameChange(event) {
    this.setState({
      newDashName: event.target.value,
      saveType: 'newDashboard',
    });
  }
  saveDashboardRequest(data, url, saveType) {
    const saveModal = this.modal;
    const onSaveDashboard = this.props.onSave;
    Object.assign(data, { css: this.props.css });
    $.ajax({
      type: 'POST',
      url,
      data: {
        data: JSON.stringify(data),
      },
      success(resp) {
        saveModal.close();
        onSaveDashboard();
        if (saveType === 'newDashboard') {
          window.location = `/superset/dashboard/${resp.id}/`;
        } else {
          notify.success(t('This dashboard was saved successfully.'));
        }
      },
      error(error) {
        saveModal.close();
        const errorMsg = getAjaxErrorMsg(error);
        notify.error(t('Sorry, there was an error saving this dashboard: ') + '</ br>' + errorMsg);
      },
    });
  }
  saveDashboard(saveType, newDashboardTitle) {
    const dashboard = this.props.dashboard;
    const positions = this.props.serialize();
    const data = {
      positions,
      css: this.state.css,
      expanded_slices: dashboard.metadata.expanded_slices || {},
      dashboard_title: dashboard.dashboard_title,
      default_filters: JSON.stringify(this.props.filters),
      duplicate_slices: this.state.duplicateSlices,
      folder_id: this.state.saveToFolderId,
    };
    let url = null;
    if (saveType === 'overwrite') {
      url = `/superset/save_dash/${dashboard.id}/`;
      this.saveDashboardRequest(data, url, saveType);
    } else if (saveType === 'newDashboard') {
      if (!newDashboardTitle) {
        this.modal.close();
        showModal({
          title: t('Error'),
          body: t('You must pick a name for the new dashboard'),
        });
      } else {
        data.dashboard_title = newDashboardTitle;
        url = `/superset/copy_dash/${dashboard.id}/`;
        this.saveDashboardRequest(data, url, saveType);
      }
    }
  }
  render() {
    const optionsFolder = [{ value: '', label: t(' -- No parent folder -- ') }].concat(this.state.folders);
    return (
      <ModalTrigger
        ref={(modal) => { this.modal = modal; }}
        isMenuItem
        triggerNode={this.props.triggerNode}
        modalTitle={t('Save Dashboard')}
        modalBody={
          <FormGroup>
            <Radio
              value="overwrite"
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === 'overwrite'}
            >
              {t('Overwrite Dashboard [%s]', this.props.dashboard.dashboard_title)}
            </Radio>
            <hr />
            <Radio
              value="newDashboard"
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === 'newDashboard'}
            >
              {t('Save as:')}
            </Radio>
            <FormControl
              type="text"
              placeholder={t('[dashboard name]')}
              value={this.state.newDashName}
              onFocus={this.handleNameChange}
              onChange={this.handleNameChange}
            />
            <div className="m-l-25 m-t-5">
              <Checkbox
                checked={this.state.duplicateSlices}
                onChange={this.toggleDuplicateSlices.bind(this)}
              />
              <span className="m-l-5">
                {t('also copy (duplicate) slices')}
              </span>
            </div>
            <Select
              className="save-modal-selector"
              options={optionsFolder}
              onChange={this.onChangeFolder}
              autoSize={false}
              value={this.state.saveToFolderId}
              placeholder={t('Select folder')}
              optionRenderer={RenderLevelsSelectOption}
            />
          </FormGroup>
        }
        modalFooter={
          <div>
            <Button
              bsStyle="primary"
              onClick={() => { this.saveDashboard(this.state.saveType, this.state.newDashName); }}
            >
              {t('Save')}
            </Button>
          </div>
        }
      />
    );
  }
}
SaveModal.propTypes = propTypes;

export default SaveModal;
