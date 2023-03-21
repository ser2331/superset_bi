import React, { PropTypes } from "react";
import { Button } from "react-bootstrap";
import TextControl from "./TextControl";
import "./FilterNode.css";
import { t } from "../../../locales";
import ControlHeader from "../ControlHeader";
import ColorPickerControl from "./ColorPickerControl";
import CheckboxControl from './CheckboxControl';
export class ConditionalFormattingSector extends React.Component {
  changeSectorValues = (valueField, field) => {
    const { id, value, onChange } = this.props;
    onChange(id, { ...value, [field]: valueField });
  };

  render() {
    const {
      value,
      onRemoveSector,
      errorPositions,
      showLabelsDownUp,
    } = this.props;
    const { description, from, to, color, labelDown, labelUp } = value || {};
    const hasError = Boolean(errorPositions?.length);
    return (
      <div>
        <div className={`node-card ${hasError ? "error" : ""}`}>
          <TextControl
            className={"form-group"}
            placeholder={t("Description")}
            value={description || ""}
            name={"description"}
            onChange={(val) => this.changeSectorValues(val, "description")}
          />
          <div className={"select-from-to-wrap form-group"}>
            <ControlHeader label={t("Select range:")} />
            <TextControl
              className={`select-from-to ${
                errorPositions?.includes("from") ? "error" : ""
              }`}
              name={"from"}
              placeholder={t("From")}
              value={from}
              onChange={(val) =>
                this.changeSectorValues(
                  val
                    ? val
                        .replace(/[^-.0-9]/gm, "")
                        .replace(/\./, "$$$$$")
                        .replace(/\./g, "")
                        .replace("$$$", ".")
                    : "",
                  "from"
                )
              }
            />
            <TextControl
              className={`select-from-to ${
                errorPositions?.includes("to") ? "error" : ""
              }`}
              name={"to"}
              placeholder={t("To")}
              value={to}
              onChange={(val) =>
                this.changeSectorValues(
                  val
                    ? val
                        .replace(/[^-.0-9]/gm, "")
                        .replace(/\./, "$$$$$")
                        .replace(/\./g, "")
                        .replace("$$$", ".")
                    : "",
                  "to"
                )
              }
            />
          </div>
          <div className={"select-from-to-wrap form-group"}>
            {showLabelsDownUp && (
              <div style={{ width: "100%", display: "flex", flexWrap: "wrap" }}>
                <ControlHeader label={t("Select label")} />
                <TextControl
                  placeholder={t("Label down")}
                  className={"select-from-to"}
                  value={labelDown || ""}
                  name={"labelDown"}
                  onChange={(val) =>
                    this.changeSectorValues(val.substr(0, 255), "labelDown")
                  }
                />
                <TextControl
                  placeholder={t("Label up")}
                  className={"select-from-to"}
                  value={labelUp || ""}
                  name={"labelUp"}
                  onChange={(val) =>
                    this.changeSectorValues(val.substr(0, 255), "labelUp")
                  }
                />
              </div>
            )}
            <div className={"flex"}>
              <ColorPickerControl
                value={color}
                name={"color"}
                label={t("Color")}
                onChange={(val) => this.changeSectorValues(val, "color")}
                disableAlpha
              />
              <Button onClick={onRemoveSector} bsSize="sm">
                <i className="fa fa-minus" /> &nbsp; {t("Remove item")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

ConditionalFormattingSector.propTypes = {
  value: PropTypes.object,
  onRemoveSector: PropTypes.func,
  onChange: PropTypes.func,
  id: PropTypes.number,
  errorPositions: PropTypes.array,
  showLabelsDownUp: PropTypes.bool,
};

ConditionalFormattingSector.defaultProps = {
  onChange: () => {},
};

export default ConditionalFormattingSector;
