import { checkDDHierarchyExist, checkDDShowMenu } from "./helpers/checkDDShowMenu";
import cursor from './contextMenuCursor.png';

import "./DDVisualization.scss";

export const nvd3DDVisualization = (slice, payload) => {
  const isShowDDMenu = checkDDShowMenu(payload?.hierarchy, slice?.formData);

  if (isShowDDMenu) {
    const iconDDButton = document
      .querySelector(`#${slice.containerId}`)
      ?.closest(".slice-cell")
      ?.querySelector(".url_drillDowns");

    if (iconDDButton) {
      iconDDButton.style.display = "inline";

      if (slice.formData.viz_type === "line") {
        const svgContainer = document.querySelector(`#${slice.containerId}`);

        const setContextMenuCursor = () => {
          const hover = svgContainer?.querySelector('.nvGroupDD .hover');
          document.body.style.cursor = hover ? `url('${cursor}'), auto` : 'default';
        };

        svgContainer?.addEventListener('mousemove', () => setContextMenuCursor());
      }

      iconDDButton.onfocus = () => {
        const svgContainer = document.querySelector(`#${slice.containerId} svg`);
        if (slice.formData.viz_type === "line") {
          const groupSvgDD = Array.from(svgContainer?.querySelectorAll("g.nvGroupDD") ?? []);

          groupSvgDD.forEach((group) => {
            const pathBase = group.querySelector("path.nv-line:not(.secondStrokeDDPath)");
            const pathSecondStroke = group.querySelector("path.nv-line.secondStrokeDDPath");

            if (!pathSecondStroke && pathBase) {
              const secondStrokePath = pathBase?.cloneNode();
              secondStrokePath?.classList.add("secondStrokeDDPath");
              group.insertAdjacentElement("beforeend", secondStrokePath);
            } else if (pathBase && pathSecondStroke) {
              const coords = pathBase.getAttribute('d');
              pathSecondStroke.setAttribute('d', coords);
            }
            group?.classList.add("groupPathsDD");
          });
          svgContainer?.classList?.add("svgNvd3ContainerPathGroups");
        } else {
          svgContainer?.classList?.add("svgNvd3Container");
        }
      };
      iconDDButton.onblur = () => {
        const svgContainer = document.querySelector(`#${slice.containerId} svg`);
        if (slice.formData.viz_type === "line") {
          svgContainer?.classList?.remove("svgNvd3ContainerPathGroups");
        } else {
          svgContainer?.classList?.remove("svgNvd3Container");
        }
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

export const checkVizTypeDDLines = (event, namesSet, slice, payload) => {
  const keyTypeEvent = 'originalKey' in event ? event.originalKey instanceof Array ? event.originalKey[0] : event.originalKey : event.key;

  return (
    checkDDHierarchyExist(payload.hierarchy, slice.formData) ||
    slice.formData.metrics.length === 1 ||
    namesSet.has(keyTypeEvent)
  );
};
