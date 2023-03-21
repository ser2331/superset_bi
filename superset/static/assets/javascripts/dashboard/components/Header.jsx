import React from "react";
import PropTypes from "prop-types";

import Controls from "./Controls";
import EditableTitle from "../../components/EditableTitle";
import Button from "../../components/Button";
import FaveStar from "../../components/FaveStar";
import InfoTooltipWithTrigger from "../../components/InfoTooltipWithTrigger";
import TooltipWrapper from "../../components/TooltipWrapper";
import { t } from "../../locales";
import "./Header.scss";

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool,
  addSlicesToDashboard: PropTypes.func,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  fetchFaveStar: PropTypes.func,
  renderSlices: PropTypes.func,
  saveFaveStar: PropTypes.func,
  serialize: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  updateDashboardTitle: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  unsavedChanges: PropTypes.bool.isRequired,
  exportToPDF: PropTypes.func,
  allSliceLoaded: PropTypes.bool,
  exportedPdf: PropTypes.bool,
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleSaveTitle = this.handleSaveTitle.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
  }
  handleSaveTitle(title) {
    this.props.updateDashboardTitle(title);
  }
  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }
  renderUnsaved() {
    if (!this.props.unsavedChanges) {
      return null;
    }
    return (
      <InfoTooltipWithTrigger
        label="unsaved"
        tooltip={t("Unsaved changes")}
        icon="exclamation-triangle"
        className="text-danger m-r-5"
        placement="top"
      />
    );
  }
  renderEditButton() {
    const btnText = this.props.editMode ? t("Switch to View Mode") : t("Edit Dashboard");
    return (
      <Button bsStyle="default" className="m-r-5" style={{ width: "250px" }} onClick={this.toggleEditMode}>
        {btnText}
      </Button>
    );
  }
  render() {
    const dashboard = this.props.dashboard;
    const { dash_edit_perm: canConfig, dash_favstar_perm: canFavstar } = dashboard || {};

    return (
      <div className="title">
        <div className="pull-left">
          <h1 className="outer-container pull-left">
            {dashboard.prevState && (
              <a
                href={`/superset/dashboard/${dashboard.prevState.id}/?hid=${dashboard.prevState.hid}&hid_index=${dashboard.prevState.hid_index}`}
              >
                <TooltipWrapper placement="top" label="move" tooltip={t("Back")}>
                  <i className="fa fa-arrow-left dashboard-header__back" />
                </TooltipWrapper>
              </a>
            )}
            <EditableTitle
              title={dashboard.dashboard_title}
              canEdit={dashboard.dash_save_perm && this.props.editMode}
              onSaveTitle={this.handleSaveTitle}
              showTooltip={this.props.editMode}
            />
            {!!canFavstar && (
              <span className="favstar m-r-5">
                <FaveStar
                  itemId={dashboard.id}
                  fetchFaveStar={this.props.fetchFaveStar}
                  saveFaveStar={this.props.saveFaveStar}
                  isStarred={this.props.isStarred}
                />
              </span>
            )}
            {this.renderUnsaved()}
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: "35px" }}>
          {!!canConfig && this.renderEditButton()}
          <Controls
            dashboard={dashboard}
            filters={this.props.filters}
            userId={this.props.userId}
            addSlicesToDashboard={this.props.addSlicesToDashboard}
            onSave={this.props.onSave}
            onChange={this.props.onChange}
            renderSlices={this.props.renderSlices}
            serialize={this.props.serialize}
            startPeriodicRender={this.props.startPeriodicRender}
            editMode={this.props.editMode}
            exportToPDF={this.props.exportToPDF}
            allSliceLoaded={this.props.allSliceLoaded}
            exportedPdf={this.props.exportedPdf}
          />
        </div>
        <div className="clearfix" />
      </div>
    );
  }
}
Header.propTypes = propTypes;

export default Header;
