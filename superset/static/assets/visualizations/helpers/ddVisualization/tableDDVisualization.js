import { checkDDShowMenu } from "./helpers/checkDDShowMenu";

import "./DDVisualization.scss";

export const tableDDVisualization = (slice, payload) => {
  const isShowDDMenu = checkDDShowMenu(payload?.hierarchy, slice?.formData);

  if (isShowDDMenu) {
    const containerDDTables = document.querySelector(`#${slice.containerId}`);

    const hideHeader = document.querySelectorAll(`#${slice.containerId} table`)?.[1]?.querySelector("thead");
    if (hideHeader?.clientHeight < 5) {
      hideHeader.style.visibility = "hidden";
    }

    const iconDDButton = document
      .querySelector(`#${slice.containerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");
    if (iconDDButton) {
      iconDDButton.style.display = "inline";
      iconDDButton.onfocus = () => {
        containerDDTables?.classList.add("tableDDContainer");
      };
      iconDDButton.onblur = () => {
        containerDDTables?.classList.remove("tableDDContainer");
      };
    }
  } else {
    const iconDDButton = document
      .querySelector(`#${slice.containerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");
    if(iconDDButton) {
      iconDDButton.style.display = "none";
    }
  }
};
