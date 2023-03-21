/* Reusable validator functions used in controls definitions
 *
 * validator functions receive the v and the configuration of the control
 * as arguments and return something that evals to false if v is valid,
 * and an error message if not valid.
 * */
import { t } from "../locales";
import { checkerNumber } from "../utils/common";

export function numeric(v) {
  if (v && isNaN(v)) {
    return t("is expected to be a number");
  }
  return false;
}

export function integer(v) {
  if (v && (isNaN(v) || parseInt(v, 10) !== +v)) {
    return t("is expected to be an integer");
  }
  return false;
}

export function nonEmpty(v) {
  if (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  ) {
    return t("cannot be empty");
  }
  return false;
}

const getIsPercentageCorrect = (...args) => args.every(value => parseFloat(value) <= 100 && parseFloat(value) >= 0)

const getValueFromPercentage = (percentage, max) => (parseFloat(percentage) *  parseFloat(max)) / 100

export function sectorsRanges(arrayOfSectors, maxValue, percentageRange) {
  let prevFrom = null;
  let prevTo = null;

  const isValid = arrayOfSectors.every((range) => {
    let isCorrect = true;
    const { from: fromInitial, to: toInitial } = range;
    const from  = percentageRange ? getValueFromPercentage(fromInitial, maxValue) : fromInitial
    const to  = percentageRange ? getValueFromPercentage(toInitial, maxValue) : toInitial


    const isNotValid =
      !checkerNumber(from) ||
      !checkerNumber(to) ||
      (prevTo && parseFloat(prevTo) > parseFloat(from)) ||
      parseFloat(from) > parseFloat(to) ||
      parseFloat(from) === parseFloat(to)

    const isNotValidWithPercent =
      isNotValid || !getIsPercentageCorrect(fromInitial, toInitial)

    if (percentageRange ? isNotValidWithPercent : isNotValid) {
      isCorrect = false;
    }
    if (from === 0 && to === 0) {
      isCorrect =  true;
    }
    prevFrom = from;
    prevTo = to;
    return isCorrect;
  });
  return isValid ? false : t("error ranges");
}

const updatePosition = (position, value) => position.includes(value) ? [...position] : [...position, value]


export function getValidationErrorsPositions(arrayOfSectors,
   maxValue, percentageRange) {
  const validationErrorsPositions = [];
  let prevTo = null;

  arrayOfSectors.forEach((range, index, array) => {
    let position = [];
    const { from: fromInitial, to: toInitial } = range;
    const from  = percentageRange ? getValueFromPercentage(fromInitial, maxValue) : fromInitial
    const to  = percentageRange ? getValueFromPercentage(toInitial, maxValue) : toInitial

    if (percentageRange) {
      if (!getIsPercentageCorrect(fromInitial)) {
        position = updatePosition(position, 'from')
      }
      if (!getIsPercentageCorrect(toInitial)) {
        position = updatePosition(position, 'to')
      }
    }

    if (!checkerNumber(from)) {
      position = updatePosition(position, 'from')
    }
    if (!checkerNumber(to)) {
      position = updatePosition(position, 'to')
    }
    if (prevTo && parseFloat(from) < parseFloat(prevTo)) {
      position = updatePosition(position, 'from')
    }
    if ( parseFloat(to) <= parseFloat(from)) {
      position = updatePosition(position, 'to')
      position = updatePosition(position, 'from')
    }

    const nextSection = array[index + 1]
    let { next: nextFrom } = nextSection || {}
    if (nextFrom && percentageRange) {
      nextFrom = getValueFromPercentage(nextFrom, maxValue)
    }
    if (nextFrom && parseFloat(nextFrom) < parseFloat(to)) {
      position = updatePosition(position, 'to')
    }
    prevTo = to;
    validationErrorsPositions.push(position)
  });
  return validationErrorsPositions;
}
