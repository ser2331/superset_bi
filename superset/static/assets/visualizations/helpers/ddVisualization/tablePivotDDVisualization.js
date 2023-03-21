import { checkDDShowMenu } from "./helpers/checkDDShowMenu";
import "./DDVisualization.scss";

const dispatcherStepsIterations = (count) => {
  switch (true) {
    case count <= 3000:
      return 150;
    case count <= 6000:
      return 300;
    case count <= 9000:
      return 500;
    default:
      return 750;
  }
};

const addDDVisualizationForCells = (allCells, menu, iconDDButton, countIterationForOnce) => {
  if (allCells?.length !== 0) {
    const countIteration = allCells.length > countIterationForOnce ? countIterationForOnce : allCells.length;
    for (let i = 0; i <= countIteration; i++) {
      const currentCell = allCells?.[i];
      if (currentCell && menu({ target: currentCell }).length) {
        allCells?.[i]?.classList.add("contextMenuCursor");
      }
    }
    Promise.resolve().then(() =>
      setTimeout(
        () => addDDVisualizationForCells(allCells.slice(countIteration), menu, iconDDButton, countIterationForOnce),
        35
      )
    );
  } else {
    iconDDButton.classList.remove("noneTouchCursor");
  }
};

export const tablePivotDDVisualization = (slice, payload, menu) => {
  const isShowDDMenu = checkDDShowMenu(payload?.hierarchy, slice?.formData);

  if (isShowDDMenu) {
    const allCells = Array.from(document.querySelectorAll(`#${slice.containerId} table td`));

    const iconDDButton = document
      .querySelector(`#${slice.containerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");

    if (iconDDButton && allCells.length) {
      const currentContainer = document.querySelector(`#${slice.containerId}`);
      iconDDButton.classList.add("noneTouchCursor");
      addDDVisualizationForCells(allCells, menu, iconDDButton, dispatcherStepsIterations(allCells.length));

      iconDDButton.style.display = "inline";
      iconDDButton.onfocus = () => currentContainer?.classList.add("tablePivotDDContainer");
      iconDDButton.onblur = () => currentContainer?.classList.remove("tablePivotDDContainer");
    }
  } else {
    const iconDDButton = document
      .querySelector(`#${slice.containerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");
    if (iconDDButton) {
      iconDDButton.style.display = "none";
    }
  }
};
