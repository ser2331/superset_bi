import "./DDVisualization.scss";

export const directedForceDDVisualization = (slice) => {
  const iconDDButton = document
    .querySelector(`#${slice.containerId}`)
    ?.closest(".slice-cell")
    ?.querySelector(".url_drillDowns");

  const countElementsHasDDMenu = document.querySelectorAll?.(`#${slice.containerId} svg g.contextMenuCursor`);

  if (iconDDButton && countElementsHasDDMenu?.length) {
    iconDDButton.style.display = "inline";

    iconDDButton.onfocus = () => {
      const containerGraphicSvg = document.querySelector(`#${slice.containerId}`);
      containerGraphicSvg.classList.add("circleDDVisualization");
    };
    iconDDButton.onblur = () => {
      const containerGraphicSvg = document.querySelector(`#${slice.containerId}`);
      containerGraphicSvg.classList.remove("circleDDVisualization");
    };
  } else if (iconDDButton) iconDDButton.style.display = "none";
};
