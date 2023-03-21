import { refactorPositionPie } from "./sliceLegendNamesPie";

export const rerenderBigLegend = (slice, chart) => {
  const legendHeight = chart.legend.height;
  let height = slice.height();

  const svgContainer = document.querySelector(`#${slice.containerId}`);
  const svg = svgContainer?.querySelector("svg");

  svgContainer.classList.add("containerOverflow");
  svg?.classList.add("svgHeight");

  const showLegendBtnOld = document.querySelector(`#${slice.containerId} .showLegendBtn`);
  if(showLegendBtnOld) {
    showLegendBtnOld.remove();
  }

  const legendButton = document.createElement("div");
  legendButton.setAttribute("class", "showLegendBtn addMargin");

  const arrow = document.createElement("div");
  arrow.setAttribute("class", "arrow down");
  legendButton.appendChild(arrow);

  const showLegendBtn = document.createElement("span");
  showLegendBtn.innerText = "Легенда";
  legendButton.appendChild(showLegendBtn);

  // Показать кнопку "спрятать легенду" если есть легенда и она больше высоты окна просмотра / 2
  if(legendHeight() > height / 2) {
    if(slice.formData.reduce_x_ticks) {
      svgContainer?.style.setProperty("--overflowX", "hidden");
    } else {
      svgContainer?.style.setProperty("--overflowX", "auto");
    }
    svgContainer?.style.setProperty("--overflowY", "hidden");
    // При нажатии на кнопку показать легенду
    legendButton.addEventListener("click", () => {
      if(chart.showLegend()) {
        //спрятать легенду
        svg?.style.setProperty("--transformX", -legendHeight() + 50 + "px");
        svg?.style.setProperty("--height", height + legendHeight() + "px");

        svgContainer?.style.setProperty("--overflowX", "hidden");
        svgContainer?.style.setProperty("--overflowY", "hidden");
        arrow.setAttribute("class", "arrow right");
        chart.showLegend(false);
        const newHeight = height + legendHeight() - 50;

        if(slice.formData.viz_type === "pie") {
          refactorPositionPie(chart, slice, newHeight);
        } else {
          chart.height(slice.height() + chart.legend.height() - 150);
          chart.update();
        }
      } else {
        //показать легенду
        svg?.style.setProperty("--height", height + "px");
        svg?.style.setProperty("--transformX", 0 + "px");

        svgContainer?.style.setProperty("--overflowX", "hidden");
        svgContainer?.style.setProperty("--overflowY", "scroll");

        arrow.setAttribute("class", "arrow down");
        chart.height(height - 24);
        chart.showLegend(true);

        if(slice.formData.viz_type === "pie") {
          refactorPositionPie(chart, slice);
        } else {
          chart.update();
        }
      }
    });

    svgContainer?.insertAdjacentElement("afterbegin", legendButton);
  } else {
    if(slice.formData.reduce_x_ticks) {
      svgContainer?.style.setProperty("--overflowX", "hidden");
      svgContainer?.style.setProperty("--overflowY", "hidden");
    } else {
      svgContainer?.style.setProperty("--overflowX", "auto");
      svgContainer?.style.setProperty("--overflowY", "auto");
    }
  }
};
