import "./sliceLegendNamesPie.css";

function setAttributes(arr, cols, reduceX, textWidth) {
  let y = 0;
  for(let i = 0; i < arr.length; i += 1) {
    if(i <= cols) {
      y += reduceX ? 12 : 20;
      let x = 0;
      arr[i]?.forEach((el) => {
        const transformValX = x + "px";
        const transformValY = y + "px";
        el.style.setProperty("--transformValX", transformValX);
        el.style.setProperty("--transformValY", transformValY);
        el.classList.add("transformLegendBtn");
        x += reduceX ? 14 : textWidth + 24;
      });
    }
  }
}

function setAttributesForPrimeSlice(arr, reduceX, textWidth) {
  let x = 0;
  let y = 0;

  arr[0]?.forEach((el) => {
    const transformValX = x + "px";
    const transformValY = y + "px";

    el?.style.setProperty("--transformValX", transformValX);
    el?.style.setProperty("--transformValY", transformValY);
    el?.classList.add("transformLegendBtn");

    x += reduceX ? 14 : textWidth + 24;
  });
}

function breakUp(array, cols) {
  let newArrays = [];
  for(let i = 0; i < array.length; i += cols) {
    newArrays.push(array.slice(i, i + cols));
  }
  return newArrays;
}

const refactorPositions = (slice, widthControl) => {
  const pieChart = document.querySelector(`#${slice.containerId}`);
  const legendWrap = document.querySelector(`#${slice.containerId} .nvd3.nv-legend`);

  legendWrap?.children[0].setAttribute("transform", "translate(20, 20)");
  const maxWidth = slice.width() - 150;

  const allLegendButtons = pieChart?.querySelectorAll(".nv-legendWrap.nvd3-svg .nv-series");
  const btnsArr = (allLegendButtons && Array.from(allLegendButtons)) || [];
  //Количество в 1 строке
  const colItemsInRow = Math.abs(Math.floor(maxWidth / widthControl)) || 1;

  //Количество строк
  const colRows = Math.abs(Math.ceil(btnsArr?.length / colItemsInRow));

  const arrays = breakUp(btnsArr, colItemsInRow);

  setAttributesForPrimeSlice(arrays?.slice(0, 1), false, widthControl);

  setAttributes(arrays.slice(1, arrays?.length), colRows, false, widthControl);
};

export const sliceLegendNamesPie = (slice, isCollapse) => {
  if(slice.formData.viz_type === "pie") {
    const svgContainer = document.querySelector(`#${slice.containerId}`);
    const legend = svgContainer?.querySelector(".nv-legendWrap.nvd3-svg");
    if(isCollapse) {
      legend.style.visibility = "hidden";
      return;
    }
    const textArr = legend?.querySelectorAll("text");
    const maxKeyLength = Number(slice.formData.legend_characters_number) || 20;

    const maxWidthTextArr = [];
    textArr && textArr.length && textArr?.forEach((text) => {
      if(text.innerHTML.length > maxKeyLength) {
        text.innerHTML = text.innerHTML.slice(0, Number(maxKeyLength)) + "...";
      }
      maxWidthTextArr.push(text.getBoundingClientRect().width || 130);
    });
    refactorPositions(slice, Math.max.apply(0, maxWidthTextArr));
    legend.style.visibility = "visible";
  }
};

let legendHeight = 100;
export const refactorPositionPie = (chart, slice, newHeight) => {
  if(slice.formData.viz_type === "pie") {
    const svgContainer = document.querySelector(`#${slice.containerId}`);
    const legend = svgContainer?.querySelector(".nv-legendWrap.nvd3-svg");
    const chartPie = svgContainer.querySelector(".nv-pieWrap.nvd3-svg");

    if(chart.showLegend()) {
      legendHeight = legend.getBoundingClientRect().height || legendHeight;
      chart.height(slice.height() + chart.legend.height() - legendHeight - 50);
      chartPie.setAttribute("transform", `translate(0, -${chart.legend.height() - legendHeight - 30})`);
      chart.update();
      sliceLegendNamesPie(slice);
      splitLabelIntoMultipleLines(slice);
      sliceNamesPie(slice);
    } else {
      chart.height(newHeight - 50);
      chart.update();
      chartPie.removeAttribute("transform");
    }
  }
};

const types = new Set(["key", "key_value", "key_percent"]);
const escapeHTML = str =>
  str.replace(
    /[&<>'"]/g,
    tag =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
      }[tag] || tag)
  );

//Разделяем строку на несколько строк svg
function svgStrToTspan(str, lineHeight) {
  const namesArr = str.split(",");
  return namesArr.map((t, i) => {
    if(!t.length) {
      return;
    }
    if(t.length >= 20) {
      return t.split(" ").map((subtext, index) => `<tspan
            x="0"
            dy="${i === 0 && index === 0 ? "0" : `${lineHeight}`}"
            ${subtext.length === 0 ? "visibility=\"hidden\"" : ""}>
 
                ${subtext.length === 0 ?
        "." :
        escapeHTML(subtext).replaceAll(" ", "&nbsp;")}
 
            </tspan>`).join("");
    }
    return `<tspan
            x="0"
            dy="${i === 0 ? "0" : `${lineHeight}`}"
            ${t.length === 0 ? "visibility=\"hidden\"" : ""}>
 
                ${t.length === 0 ?
      "." :
      escapeHTML(t).replaceAll(" ", "&nbsp;")}
                ${namesArr.length !== i && namesArr.length !== i + 1 ? "," : ""}
 
            </tspan>`;
  }).join("");
}

export const splitLabelIntoMultipleLines = (slice, isCollapse) => {
  const type = slice.formData.pie_label_type;
  if(
    slice.formData.split_label_into_multiple_lines &&
    slice.formData.viz_type === "pie" &&
    types.has(type)
  ) {
    const svgContainer = document.querySelector(`#${slice.containerId}`);
    const nvPieLabels = svgContainer?.querySelector(".nv-pieLabels");
    const labelsWraps = nvPieLabels.querySelectorAll(".nv-label");
    labelsWraps?.forEach((labelWrap) => {
      const textEl = labelWrap.querySelector("text");
      if(isCollapse) {
        textEl.style.visibility = "hidden";
        return;
      }
      const content = textEl.innerHTML;
      const reg = /span/gi;
      const isRerender = reg.test(content);
      if(isRerender) {
        return;
      }
      textEl.innerHTML = svgStrToTspan(content, 15);
      textEl.style.visibility = "visible";
    });
  }
};
export const sliceNamesPie = (slice, isCollapse) => {
  const type = slice.formData.pie_label_type;
  if(
    slice.formData.slice_large_labels &&
    !slice.formData.split_label_into_multiple_lines &&
    slice.formData.viz_type === "pie" &&
    types.has(type)
  ) {

    const svgContainer = document.querySelector(`#${slice.containerId}`);
    const nvPieLabels = svgContainer?.querySelector(".nv-pieLabels");
    const labelsWraps = nvPieLabels.querySelectorAll(".nv-label");
    labelsWraps?.forEach((labelWrap) => {
      const textEl = labelWrap.querySelector("text");
      if(isCollapse) {
        textEl.style.visibility = "hidden";
        return;
      }
      const content = textEl.innerHTML;
      if(content && content.length) {
        const index = content.indexOf(":");
        const val = type === "key" ? "" : content.slice(index, content.length);
        const spread = content.length > 20 ? "... " : "";
        textEl.innerHTML = content.slice(0, 20) + spread + val;
        textEl.style.visibility = "visible";
      }
    });
  }
};
