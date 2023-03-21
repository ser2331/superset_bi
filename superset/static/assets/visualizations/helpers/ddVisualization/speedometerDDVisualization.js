import "./DDVisualization.scss";

export const speedometerDDVisualization = (countItemsDDMenu, sliceContainerId) => {
  const containerSvg = document.querySelector(`#${sliceContainerId} svg.speedometer`);
  if (countItemsDDMenu.length) {
    const iconDDButton = document
      .querySelector(`#${sliceContainerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");

    if (iconDDButton) {
      containerSvg?.classList.add("contextMenuCursor");
      iconDDButton.style.display = "inline";

      iconDDButton.onfocus = () => {
        containerSvg?.classList?.add("speedometerDD");
      };
      iconDDButton.onblur = () => {
        containerSvg?.classList.remove("speedometerDD");
      };
    }
  } else {
    const iconDDButton = document
      .querySelector(`#${sliceContainerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");
    if(iconDDButton) {
      iconDDButton.style.display = "none";
    }
  }
};
