/* eslint camelcase: 0 */
import React from "react";
import PropTypes from "prop-types";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { Alert, Tab, Tabs } from "react-bootstrap";
import visTypes, { sectionsToRender } from "../stores/visTypes";
import ControlPanelSection from "./ControlPanelSection";
import ControlRow from "./ControlRow";
import Control from "./Control";
import controls from "../stores/controls";
import * as actions from "../actions/exploreActions";
import { t } from "../../locales";

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  successAlert: PropTypes.string,
  datasource_type: PropTypes.string.isRequired,
  exploreState: PropTypes.object.isRequired,
  controls: PropTypes.object.isRequired,
  form_data: PropTypes.object.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  slice: PropTypes.object,
};

class ControlPanelsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.removeAlert = this.removeAlert.bind(this);
    this.removeSuccessAlert = this.removeSuccessAlert.bind(this);
    this.getControlData = this.getControlData.bind(this);
    this.renderControlPanelSection = this.renderControlPanelSection.bind(this);
  }
  getControlData(controlName) {
    const control = this.props.controls[controlName];
    // Identifying mapStateToProps function to apply (logic can't be in store)
    let mapF = controls[controlName].mapStateToProps;

    // Looking to find mapStateToProps override for this viz type
    const controlOverrides =
      visTypes[this.props.controls.viz_type.value].controlOverrides || {};
    if (
      controlOverrides[controlName] &&
      controlOverrides[controlName].mapStateToProps
    ) {
      mapF = controlOverrides[controlName].mapStateToProps;
    }
    // Applying mapStateToProps if needed
    if (mapF) {
      return Object.assign({}, control, mapF(this.props.exploreState, control));
    }
    return control;
  }
  sectionsToRender() {
    return sectionsToRender(
      this.props.form_data.viz_type,
      this.props.datasource_type
    );
  }
  removeAlert() {
    this.props.actions.removeControlPanelAlert();
  }
  removeSuccessAlert() {
    this.props.actions.removeControlPanelSuccessAlert();
  }
  renderControlPanelSection(section) {
    const ctrls = this.props.controls;
    const hasErrors = section.controlSetRows.some((rows) =>
      rows.some((s) => Boolean(ctrls[s]?.validationErrors?.length))
    );

    return (
      <ControlPanelSection
        key={section.label}
        label={section.label}
        startExpanded={section.expanded}
        hasErrors={hasErrors}
        description={section.description}
        vizType={this.props.form_data.viz_type}
      >
        {section.controlSetRows.map((controlSets, i) => (
          <ControlRow
            key={`controlsetrow-${i}`}
            className="control-row"
            controls={controlSets.map(
              (controlName) =>
                controlName &&
                ctrls[controlName] && (
                  <Control
                    name={controlName}
                    key={`control-${controlName}`}
                    value={this.props.form_data[controlName]}
                    validationErrors={ctrls[controlName].validationErrors}
                    actions={this.props.actions}
                    vizType={this.props.form_data.viz_type}
                    slice={this.props.slice}
                    controls={ctrls}
                    {...this.getControlData(controlName)}
                  />
                )
            )}
          />
        ))}
      </ControlPanelSection>
    );
  }
  render() {
    const allSectionsToRender = this.sectionsToRender();
    const querySectionsToRender = [];
    const displaySectionsToRender = [];
    allSectionsToRender.forEach((section) => {
      if (
        section.controlSetRows.some((rows) =>
          rows.some(
            (control) =>
              controls[control] &&
              (!controls[control].renderTrigger ||
                controls[control].tabOverride === "data")
          )
        )
      ) {
        querySectionsToRender.push(section);
      } else {
        displaySectionsToRender.push(section);
      }
    });

    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {this.props.alert && (
            <Alert bsStyle="warning">
              {this.props.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert}
                style={{ cursor: "pointer" }}
              />
            </Alert>
          )}
          {this.props.successAlert && (
            <Alert bsStyle="success">
              {this.props.successAlert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeSuccessAlert}
                style={{ cursor: "pointer" }}
              />
            </Alert>
          )}
          <Tabs id="controlSections">
            <Tab eventKey="query" title={t("Data")}>
              {querySectionsToRender.map(this.renderControlPanelSection)}
            </Tab>
            {displaySectionsToRender.length > 0 && (
              <Tab eventKey="display" title={t("Style")}>
                {displaySectionsToRender.map(this.renderControlPanelSection)}
              </Tab>
            )}
          </Tabs>
        </div>
      </div>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;

function mapStateToProps({ explore, charts }) {
  const slice = charts[Object.keys(charts)[0]]
  return {
    alert: explore.controlPanelAlert,
    successAlert: explore.controlPanelSuccessAlert,
    isDatasourceMetaLoading: explore.isDatasourceMetaLoading,
    controls: explore.controls,
    exploreState: explore,
    slice,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ControlPanelsContainer);
