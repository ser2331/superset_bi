//@ts-ignore
import React from "react";
//@ts-ignore
import ReactDOM from "react-dom";
import { appSetup } from "../common";
import AddSliceContainer from "./AddSliceContainer";

appSetup();
const addSliceContainer = document.getElementById("js-add-slice-container");
const bootstrapData = JSON.parse(addSliceContainer?.getAttribute("data-bootstrap") as any);

ReactDOM.render(
  //@ts-ignore
  <AddSliceContainer datasources={bootstrapData.datasources} />,
  addSliceContainer
);

//@ts-ignore
if (module.hot) {
  //@ts-ignore
  module.hot.accept();
}
