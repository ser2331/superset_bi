import d3 from 'd3';

export const brandColor = '#00A699';
export const colorPrimary = { r: 0, g: 122, b: 135, a: 1 };

// Color related utility functions go in this object
export const newbnbColors = [
  '#ff5a5f', // rausch
  '#7b0051', // hackb
  '#007A87', // kazan
  '#00d1c1', // babu
  '#8ce071', // lima
  '#ffb400', // beach
  '#b4a76c', // barol
  '#ff8083',
  '#cc0086',
  '#00a1b3',
  '#00ffeb',
  '#bbedab',
  '#ffd266',
  '#cbc29a',
  '#ff3339',
  '#ff1ab1',
  '#005c66',
  '#00b3a5',
  '#55d12e',
  '#b37e00',
  '#988b4e',
];

export const newlyftColors = [
  '#EA0B8C',
  '#6C838E',
  '#29ABE2',
  '#33D9C1',
  '#9DACB9',
  '#7560AA',
  '#2D5584',
  '#831C4A',
  '#333D47',
  '#AC2077',
];
const googleCategory30c = [
  '#3366cc',
  '#dc3912',
  '#ff9900',
  '#109618',
  '#990099',
  '#0099c6',
  '#dd4477',
  '#66aa00',
  '#b82e2e',
  '#316395',
];
const googleCategory40c = [
  '#3366cc',
  '#dc3912',
  '#ff9900',
  '#109618',
  '#990099',
  '#0099c6',
  '#dd4477',
  '#66aa00',
  '#b82e2e',
  '#316395',
  '#994499',
  '#22aa99',
  '#aaaa11',
  '#6633cc',
  '#e67300',
  '#8b0707',
  '#651067',
  '#329262',
  '#5574a6',
  '#3b3eac',
];
export const bnbColors = ['#40b67f', '#59c986', '#93dbb0', '#b0ffd0', '#258c58'];
export const lyftColors = ['#004439', '#2a78a0', '#3499c1', '#3db4d8', '#0c4e68'];
const d3Category10 = ['#d16d1c', '#ce844d', '#d8a988', '#f9c29d', '#a05217'];
const d3Category20 = ['#3f3f3f', '#666666', '#8e8e8e', '#a5a5a5', '#cecece'];
const d3Category20b = ['#8f70a3', '#ac8bc6', '#bda7d3', '#dac3f4', '#735d84'];
const d3Category20c = ['#f8d780', '#f7e3b5', '#e5ddb8', '#fff6cc', '#c4a766'];
const googleCategory10c = ['#7bbdb5', '#8ed6cc', '#9deadd', '#9cffec', '#50a095'];
const googleCategory20c = ['#a5c9ed', '#9fddff', '#d9f1ff', '#a9ceff', '#759ffc'];

export const ALL_COLOR_SCHEMES = {
  bnbColors,
  googleCategory10c,
  googleCategory20c,
  lyftColors,
  d3Category20c,
  d3Category10,
  d3Category20b,
  d3Category20,
  newbnbColors,
  newlyftColors,
  googleCategory30c,
  googleCategory40c,
};

export const spectrums = {
  blue_white_yellow: ['#00d1c1', 'white', '#ffb400'],
  fire: ['white', 'yellow', 'red', 'black'],
  white_black: ['white', 'black'],
  black_white: ['black', 'white'],
  dark_blue: ['#EBF5F8', '#6BB1CC', '#357E9B', '#1B4150', '#092935'],
  pink_grey: ['#E70B81', '#FAFAFA', '#666666'],
};

/**
 * Get a color from a scheme specific palette (scheme)
 * The function cycles through the palette while memoizing labels
 * association to colors. If the function is called twice with the
 * same string, it will return the same color.
 *
 * @param {string} s - The label for which we want to get a color
 * @param {string} scheme - The palette name, or "scheme"
 * @param {string} forcedColor - A color that the caller wants to
    forcibly associate to a label.
 */
export const getColorFromScheme = (function() {
  const seen = {};
  const forcedColors = {};
  return function(s, scheme, forcedColor) {
    if (!s) {
      return;
    }
    const selectedScheme = scheme ? ALL_COLOR_SCHEMES[scheme] : ALL_COLOR_SCHEMES.bnbColors;
    let stringifyS = String(s).toLowerCase();
    // next line is for superset series that should have the same color
    stringifyS = stringifyS.replace('---', '');

    if (forcedColor && !forcedColors[stringifyS]) {
      forcedColors[stringifyS] = forcedColor;
    }
    if (forcedColors[stringifyS]) {
      return forcedColors[stringifyS];
    }

    if (seen[selectedScheme] === undefined) {
      seen[selectedScheme] = {};
    }
    if (seen[selectedScheme][stringifyS] === undefined) {
      seen[selectedScheme][stringifyS] = Object.keys(seen[selectedScheme]).length;
    }
    /* eslint consistent-return: 0 */
    return selectedScheme[seen[selectedScheme][stringifyS] % selectedScheme.length];
  };
})();

export const colorScalerFactory = function(colors, data, accessor, extents) {
  // Returns a linear scaler our of an array of color
  if (!Array.isArray(colors)) {
    /* eslint no-param-reassign: 0 */
    colors = spectrums[colors];
  }
  let ext = [0, 1];
  if (extents) {
    ext = extents;
  }
  if (data) {
    ext = d3.extent(data, accessor);
  }
  const chunkSize = (ext[1] - ext[0]) / (colors.length - 1);
  const points = colors.map((col, i) => ext[0] + i * chunkSize);
  return d3.scale
    .linear()
    .domain(points)
    .range(colors)
    .clamp(true);
};

export function hexToRGB(hex, alpha = 255) {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}
