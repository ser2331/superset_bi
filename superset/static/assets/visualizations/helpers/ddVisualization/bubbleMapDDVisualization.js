import "./DDVisualization.scss";

let regexpIsContextMenu = /isContextMenu/i;

export function bubbleMapDDVisualization(slice, placemarks) {
  const containerBase = document.querySelector(`#${slice.containerId}`);
  const ymapsContainer = containerBase.querySelector(`ymaps[class*="user-selection-none"]`);

  if (Array.isArray(placemarks)) {
    placemarks.forEach((placemark) => {
      placemark.events.add("mouseenter", (e) => ymapsContainer.classList.add("contextMenuCursor"));
      placemark.events.add("mouseleave", (e) => ymapsContainer.classList.remove("contextMenuCursor"));
      placemark.events.add("click", (e) => ymapsContainer.classList.remove("contextMenuCursor"));
    });
  } else {
    placemarks.events.add("mouseenter", (e) => ymapsContainer.classList.add("contextMenuCursor"));
    placemarks.events.add("mouseleave", (e) => ymapsContainer.classList.remove("contextMenuCursor"));
  }

  const iconDDButton = document
    .querySelector(`#${slice?.containerId}`)
    ?.closest(".slice-cell")
    ?.querySelector(".url_drillDowns");

  if (iconDDButton) {
    iconDDButton.style.display = "inline";
    iconDDButton.onfocus = () => containerBase.classList.add("bubbleMapDDContainer");
    iconDDButton.onblur = () => containerBase.classList.remove("bubbleMapDDContainer");
  }
}

export const bubbleMapDDVisualizationDisable = (slice) => {
  const containerBase = document.querySelector(`#${slice.containerId}`);
  containerBase.classList.remove("bubbleMapDDContainerCursor");

  const iconDDButton = document
    .querySelector(`#${slice.containerId}`)
    ?.closest(".slice-cell")
    ?.querySelector(".url_drillDowns");

  if (iconDDButton) {
    iconDDButton.style.display = "none";
  }
};

const popupContextMenuInBalloon = (slice) => {
  const container = document.querySelector(`#slice_${slice.formData.slice_id}_drilldown`);
  const iconDDButton = container?.querySelector(".url_drillDowns");
  const balloon = container?.querySelector(`ymaps[class*="balloon__layout"]`);
  const closeButtonBalloon = balloon?.querySelector(`ymaps[class*="balloon__close"]`);

  iconDDButton.style.display = "inline";
  iconDDButton.onfocus = () => balloon?.classList.add("popupDDContainer");
  iconDDButton.onblur = () => balloon?.classList.remove("popupDDContainer");

  closeButtonBalloon && closeButtonBalloon.addEventListener("click", () => (iconDDButton.style.display = "none"));
};

const containerContextMenuInBalloon = (slice) => {
  const container = document.querySelector(`#${slice.containerId}`);
  const iconDDButton = container?.closest(".slice-cell")?.querySelector(".url_drillDowns");
  const iconDDButtonHasDD = container?.closest(".slice-cell")?.querySelector(".hasDD");
  if (iconDDButton.style.display === "none" || iconDDButtonHasDD) {
    iconDDButton.classList.add("hasDD");

    const balloon = container?.querySelector(`ymaps[class*="balloon__layout"]`);
    const closeButtonBalloon = balloon?.querySelector(`ymaps[class*="balloon__close"]`);

    iconDDButton.style.display = "inline";
    iconDDButton.onfocus = () => balloon?.classList.add("popupDDContainer");
    iconDDButton.onblur = () => balloon?.classList.remove("popupDDContainer");

    closeButtonBalloon && closeButtonBalloon.addEventListener("click", () => (iconDDButton.style.display = "none"));
  }
};

export const addContextMenuCursorToBalloon = (table, slice, isPopap) => {
  table.flat().forEach((td) => {
    if (regexpIsContextMenu.test(td?.__data__?.html)) {
      if (isPopap) {
        popupContextMenuInBalloon(slice);
      } else {
        containerContextMenuInBalloon(slice);
      }

      td?.classList.add("balloonContentDD", "contextMenuCursor");
    }
  });
};
