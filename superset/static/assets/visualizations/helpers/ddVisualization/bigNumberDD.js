import "./DDVisualization.scss";

export const bigNumberDDVisualization = (slice) => {
  const urlDrillDowns = slice?.formData?.url_drilldowns ?? [];
  if (urlDrillDowns.length) {
    const bigNumberTextElement = document.querySelector(`#${slice.containerId} svg text#bigNumber`);

    const iconDDButton = document
      .querySelector(`#${slice.containerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");
    if (iconDDButton) {
      iconDDButton.style.display = "inline";
      bigNumberTextElement?.classList.add("contextMenuCursor");
      iconDDButton.onfocus = () => {
        bigNumberTextElement?.classList.add("bigNumberDD");
      };
      iconDDButton.onblur = () => {
        bigNumberTextElement?.classList.remove("bigNumberDD");
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
