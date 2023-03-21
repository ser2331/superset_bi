export const getBackgroundConditionalFormatting = (value, ranges, maxValue, percentageRange) => {
  for (const range of ranges) {
    const { color, from, to } = range;
    const parcentOrNumberValueTo = percentageRange
      ? ( maxValue * to) / 100
      : Number(to);

    const parcentOrNumberValueFrom = percentageRange
      ? (maxValue * from) / 100
      : Number(from);

    const isRangeMatches =
      value >= parcentOrNumberValueFrom && value <= parcentOrNumberValueTo;
    if (isRangeMatches) {
      return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
  }
  return null;
};

const getContrastColor = ({ r, g, b }) =>
  r * 0.299 + g * 0.587 + b * 0.114 > 186
    ? "rgb(0, 0, 0)"
    : "rgb(255, 255, 255)";

export const getColorConditionalFormatting = (value, ranges, maxValue, percentageRange) => {
  for (const range of ranges) {
    const { color, from, to } = range;
    const parcentOrNumberValueTo = percentageRange
    ? (maxValue * to) / 100
    : Number(to);

  const parcentOrNumberValueFrom = percentageRange
    ? (maxValue * from) / 100
    : Number(from);

  const isRangeMatches =
    value >= parcentOrNumberValueFrom && value <= parcentOrNumberValueTo;
    if (isRangeMatches) {
      return getContrastColor(color);
    }
  }
  return null;
};

export const isCellForConditionalFormatting = (cell) => cell.isMetric && typeof cell.val === 'number'
