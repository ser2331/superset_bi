import React from "react";
import moment from "moment";

const regExp = new RegExp("^[+\-/*.><@$&!#=\]", "g");
const regExpQuotes = /(['"])(.*?)\1/g;
const regExpQuot = /['"`]/g;

export const onValidateInputChanges = (text) => {
  const errorLogicOp = regExp.test(text);
  const errorQuotes = regExpQuotes.test(text);
  const hasQuotes = regExpQuot.test(text);

  if(errorLogicOp) {
    return "errorLogicOp";
  }


  if(hasQuotes && !errorQuotes) {
    return "errorQuotes";
  }
};

export const validateDttmChanges = (val, sqlFormat, tsFormat) => {
  let formattedValue = val;
  let formattedLabel = val;
  let classNameDttm = "errorBorder";

  if(moment(formattedValue, "YYYY-MM-DD", true).isValid() && sqlFormat === "YYYY-MM-DD") {
    classNameDttm = "";
  }
  if(moment(formattedValue, "DD-MM-YYYY", true).isValid() && sqlFormat === "YYYY-MM-DD") {
    classNameDttm = "";
  }
  if(moment(formattedValue, "HH:mm:ss", true).isValid() && (sqlFormat === "HH:mm:ss" || !sqlFormat)) {
    classNameDttm = "";
  }
  if(moment(formattedValue, "YYYY-MM-DD HH:mm:ss", true).isValid() && tsFormat === "DD-MM-YYYY HH:mm:ss") {
    classNameDttm = "";
  }

  return { formattedValue, formattedLabel, classNameDttm };
};
