/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { Modal, Alert, Button, Radio } from 'react-bootstrap';
import Select from 'react-select';
import { t } from '../../locales';
import { supersetURL } from '../../utils/common';
import RenderLevelsSelectOption from '../../components/RenderLevelsSelectOption';

const propTypes = {
  existSlice: PropTypes.bool,
  can_config: PropTypes.bool.isRequired,
  can_add: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  actions: PropTypes.object.isRequired,
  form_data: PropTypes.object,
  userId: PropTypes.string.isRequired,
  dashboards: PropTypes.array.isRequired,
  alert: PropTypes.string,
  slice: PropTypes.object,
  datasource: PropTypes.object,
  folders: PropTypes.array,
  rawFormData: PropTypes.object,
};

class SaveModal extends React.Component {
  constructor(props) {
    super(props);
    const { slice, rawFormData } = props;
    const { form_data } = slice || {};
    const { folder_id = null } = form_data || rawFormData || {};
    this.state = {
      saveToDashboardId: null,
      saveToFolderId: folder_id ?? '',
      newDashboardName: '',
      newSliceName: '',
      dashboards: [],
      alert: null,
      action: props.can_config ? 'overwrite' : 'saveas',
      addToDash: 'noSave',
    };
  }
  componentDidMount() {
    this.props.actions.fetchDashboards(this.props.userId);
    this.props.actions.fetchSlicesFolders();
  }
  onChange(name, event) {
    switch (name) {
      case 'newSliceName':
        this.setState({ newSliceName: event.target.value });
        break;
      case 'saveToDashboardId':
        this.setState({ saveToDashboardId: event.value });
        this.changeDash('existing');
        break;
      case 'newDashboardName':
        this.setState({ newDashboardName: event.target.value });
        break;
      case 'saveToFolderId':
        this.setState({ saveToFolderId: event?.value || '' });
        break;
      default:
        break;
    }
  }
  changeAction(action) {
    this.setState({ action });
  }
  changeDash(dash) {
    this.setState({ addToDash: dash });
  }
  saveOrOverwrite(gotodash) {
    this.setState({ alert: null });
    this.props.actions.removeSaveModalAlert();
    const sliceParams = {};

    let sliceName = null;
    const { action } = this.state;

    if (this.props.slice && this.props.slice.slice_id) {
      sliceParams.slice_id = this.props.slice.slice_id;
    }
    if (action === 'saveas') {
      sliceName = this.state.newSliceName;
      if (sliceName === '') {
        this.setState({ alert: t('Please enter a slice name') });
        return;
      }
      sliceParams.slice_name = sliceName;
    } else {
      sliceParams.slice_name = this.props.slice.slice_name;
    }

    // если слайс новый
    if (action === 'overwrite' && !this.props.existSlice) {
      sliceParams.action = 'saveas';
    } else {
      sliceParams.action = action;
    }
    sliceParams.folder_id = this.state.saveToFolderId || null;
    const addToDash = this.state.addToDash;
    sliceParams.add_to_dash = addToDash;
    let dashboard = null;
    switch (addToDash) {
      case ('existing'):
        dashboard = this.state.saveToDashboardId;
        if (!dashboard) {
          this.setState({ alert: t('Please select a dashboard') });
          return;
        }
        sliceParams.save_to_dashboard_id = dashboard;
        break;
      case ('new'):
        dashboard = this.state.newDashboardName;
        if (dashboard === '') {
          this.setState({ alert: t('Please enter a dashboard name') });
          return;
        }
        sliceParams.new_dashboard_name = dashboard;
        break;
      default:
        dashboard = null;
    }
    sliceParams.goto_dash = gotodash;
    this.props.actions.saveSlice(this.props.form_data, sliceParams)
      .then((data) => {
        // Go to new slice url or dashboard url
        if (gotodash) {
          window.location = supersetURL(data.dashboard, { edit: 'true' });
        } else {
          window.location = data.slice.slice_url;
        }
      });
    this.props.onHide();
  }
  removeAlert() {
    if (this.props.alert) {
      this.props.actions.removeSaveModalAlert();
    }
    this.setState({ alert: null });
  }
  render() {
    const optionsFolder = this.props.folders ? [{ value: '', label: t(' -- No parent folder -- ') }].concat(this.props.folders) : [{ value: '', label: t(' -- No parent folder -- ') }];
    return (
      <Modal
        show
        onHide={this.props.onHide}
        bsStyle="large"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t('Save A Chart')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(this.state.alert || this.props.alert) &&
            <Alert>
              {this.state.alert ? this.state.alert : this.props.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert.bind(this)}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          }
          {(this.props.slice && this.props.can_config) &&
            <Radio
              id="overwrite-radio"
              checked={this.state.action === 'overwrite'}
              onChange={this.changeAction.bind(this, 'overwrite')}
            >
              {t('Overwrite chart %s', this.props.slice.slice_name)}
            </Radio>
          }
          {this.props.can_add &&
            [<Radio
              key={1}
              id="saveas-radio"
              inline
              checked={this.state.action === 'saveas'}
              onChange={this.changeAction.bind(this, 'saveas')}
            > {t('Save as')} &nbsp;
            </Radio>,
              <input
                key={2}
                name="new_slice_name"
                placeholder={t('[chart name]')}
                onChange={this.onChange.bind(this, 'newSliceName')}
                onFocus={this.changeAction.bind(this, 'saveas')}
              />]
          }


          <br />
          <hr />

          <Radio
            checked={this.state.addToDash === 'noSave'}
            onChange={this.changeDash.bind(this, 'noSave')}
          >
            {t('Do not add to a dashboard')}
          </Radio>

          <Radio
            inline
            checked={this.state.addToDash === 'existing'}
            onChange={this.changeDash.bind(this, 'existing')}
          >
            {t('Add chart to existing dashboard')}
          </Radio>
          <Select
            className="save-modal-selector"
            options={this.props.dashboards}
            onChange={this.onChange.bind(this, 'saveToDashboardId')}
            autoSize={false}
            value={this.state.saveToDashboardId}
            placeholder={t('Select Dashboard')}
          />

          <Radio
            inline
            checked={this.state.addToDash === 'new'}
            onChange={this.changeDash.bind(this, 'new')}
          >
            {t('Add to new dashboard')} &nbsp;
          </Radio>
          <input
            onChange={this.onChange.bind(this, 'newDashboardName')}
            onFocus={this.changeDash.bind(this, 'new')}
            placeholder={t('[dashboard name]')}
          />
          <Select
            className="save-modal-selector"
            options={optionsFolder}
            onChange={this.onChange.bind(this, 'saveToFolderId')}
            autoSize={false}
            value={this.state.saveToFolderId}
            placeholder={t('Select folder')}
            optionRenderer={RenderLevelsSelectOption}
          />

        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            id="btn_modal_save"
            className="btn pull-left"
            onClick={this.saveOrOverwrite.bind(this, false)}
          >
            {t('Save')}
          </Button>
          <Button
            type="button"
            id="btn_modal_save_goto_dash"
            className="btn btn-primary pull-left gotodash"
            disabled={this.state.addToDash === 'noSave'}
            onClick={this.saveOrOverwrite.bind(this, true)}
          >
            {t('Save & go to dashboard')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

SaveModal.propTypes = propTypes;

function mapStateToProps({ explore, saveModal }) {
  return {
    existSlice: explore.existSlice,
    datasource: explore.datasource,
    slice: explore.slice,
    can_config: !!explore.can_config,
    can_add: !!explore.can_add,
    userId: explore.user_id,
    dashboards: saveModal.dashboards,
    alert: saveModal.saveModalAlert,
    folders: saveModal.folders ?? [],
    rawFormData: explore.rawFormData ?? {},
  };
}

export { SaveModal };
export default connect(mapStateToProps, () => ({}))(SaveModal);
