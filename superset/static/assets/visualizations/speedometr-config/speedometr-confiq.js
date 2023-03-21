import d3, { range as d3Range } from 'd3';
import {
  line as d3Line,
  curveMonotoneX as d3CurveMonotoneX,
  arc as d3arc,
} from 'd3-shape';
import { sum, drop, head, last, isEmpty, isArray, isNaN } from 'lodash';
import { take } from 'lodash/fp';
import { getNeedleTransition } from './get-needle-transition';



const MAX_CHAR_COUNT = 20;

export default function configureSpeedometer(config) {
  const speedometer = d3.select(`${config.container} svg.speedometer`);
  const arcs = speedometer.select('.arc');
  const toolTip = initTooltip(
    { parent: speedometer.node().parentNode },
    speedometer
  );
  const onShowTooltip = showTooltip(toolTip, speedometer);
  const onHideTooltip = hideTooltip(toolTip);
  const onMoveTooltip = moveTooltip(toolTip);

  configurePointer(config);
  configureHoverOnArcs(
    config,
    arcs,
    speedometer,
    onShowTooltip,
    onHideTooltip,
    onMoveTooltip
  );
  configureLabels(
    config,
    arcs,
    speedometer,
    onShowTooltip,
    onHideTooltip,
    onMoveTooltip
  );
}

function configurePointer(config) {
  const { value, speedometerUnit, numberFormat, container } = config;
  const format = d3.format(numberFormat);
  const r = getRadius(config);
  const centerTx = centerTranslation(r);
  const pointerLine = d3Line().curve(d3CurveMonotoneX);
  const scale = configureScale(config);
  const ratio = scale(config.value);
  const range = config.maxAngle - config.minAngle;
  const speedometer = d3.select(`${container} svg.speedometer`);
  const div = speedometer
    .select(function() {
      return this.parentNode;
    })
    .style('position', 'relative');
  const descr = div
    .append('span')
    .text(`${format(value)} ${speedometerUnit}`)
    .classed('pointer-description', true);
  const needleLength = calculateNeedleHeight({
    heightRatio: config.needleHeightRatio,
    radius: r,
  });
  const lineData = [
    [config.pointerWidth / 2, 0],
    [0, -needleLength],
    [-(config.pointerWidth / 2), 0],
    [0, config.pointerTailLength],
    [config.pointerWidth / 2, 0],
  ];

  let newAngle = config.minAngle + ratio * range;
  speedometer.select("g.pointer").remove()

  let pg = speedometer
    .append('g')
    .data([lineData])
    .attr('class', 'pointer')
    .attr('transform', centerTx)
    .style('fill', config.needleColor);

  const pointer = pg
    .append('path')
    .attr('d', pointerLine)
    .attr('transform', `rotate(${config.minAngle + 10})`);

  if (newAngle < config.minAngle) {
    newAngle = config.minAngle - 10;
  } else if (newAngle > config.maxAngle) {
    newAngle = config.maxAngle + 10;
  }
  pointer
    .transition()
    .ease(getNeedleTransition(config.needleTransition))
    .duration(config.needleTransitionDuration)
    .attr('transform', `rotate(${newAngle})`);


  pointer.on('mousemove', function() {
    const point = d3.mouse(div[0][0]);
    const x = point[0];
    const y = point[1];
    descr
      .style('left', `${x + 20}px`)
      .style('top', ` ${y - 10}px`)
      .style('opacity', 1);
  });
  pointer.on('mouseout', function() {
    descr.style('opacity', 0);
  });
}

function configureHoverOnArcs(
  config,
  arcs,
  speedometer,
  onShowTooltip,
  onHideTooltip,
  onMoveTooltip,
) {
  const htmlLabels = configureTooltipLabels(config);
  const arcHover = configureArcHover(config);
  const arc = configureArc(config);
  arcs.selectAll('path').attr('d', (d, i) => arc(i)());

  arcs
    .selectAll('path')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .on('mouseenter', function(d, i) {
      const el = d3.select(this);
      el.classed('hover', true);
      el.attr('d', arcHover(i));
      const html = htmlLabels(i);
      html && onShowTooltip(html);
    })
    .on('mouseout', function(d, i) {
      const el = d3.select(this);
      el.classed('hover', false);
      el.attr('d', arc(i));
      onHideTooltip();
    })
    .on('mousemove', function() {
      onMoveTooltip(speedometer.node().parentNode);
    });
}

function configureLabels(
  config,
  arcs,
  speedometer,
  onShowTooltip,
  onHideTooltip,
  onMoveTooltip
) {
  const labelFormat = d3.format(config.numberFormat);
  const lg = speedometer.select('.label');
  const arrayOfArcs = arcs.selectAll('path');
  const r =
    config.labelPosition !== 'INSIDE'
      ? getRadius(config) - config.labelInset
      : getInnerRadius(config) - config.labelInset * 2 - 1;
  const { maxLabelLengths, ArrayOfdiff } = getMaxLabelLength(
    config,
    arrayOfArcs
  );

  lg.selectAll('text')
    .html((d, i) => {
      const maxElWidth = maxLabelLengths[i];
      const { fixedWords } =
        getLabelText(i, config, maxElWidth, labelFormat) || {};
      const { minArcLength, direction } = ArrayOfdiff[i] || {};
      const getRows = (array, index, row) => {
        const startWord = array[index] || '';
        const nextWord = array[index + 1] || '';
        const remaind = array.slice(index + 1);
        const prevRow = row ? row : startWord;
        const nextRow = prevRow + ' ' + nextWord;
        return array.length > 1
          ? getElWidth(nextRow) < maxElWidth &&
            nextRow.length < MAX_CHAR_COUNT &&
            index < array.length
            ? getRows(array, index + 1, nextRow)
            : [prevRow, remaind]
          : [nextRow];
      };
      const rows = getRows(fixedWords, 0).map((row) => {
        const word = Array.isArray(row) ? row.join(' ') : row;
        const chars = word.split('');
        (getElWidth(word) > maxElWidth ||
          (word && word.length > MAX_CHAR_COUNT)) &&
          cutLabel(word, chars, maxElWidth);
        return chars.join('');
      });
      const rowsLengths = rows.map((row) => getElWidth(row));
      const elWidth = getMaxOfArray(rowsLengths);
      const translation =
        elWidth > minArcLength
          ? (elWidth - minArcLength) / 1.8
          : 0;
      const x = `${direction < 0 ? translation : -translation}`;

      const html =
        rows[1] && rows[1].length > 0
          ? `
      <tspan x="${x}" dy="-1em">${rows[0]}</tspan>
      <tspan x="${x}" dy="1em">${rows[1]}</tspan>
      `
          : `<tspan x="${x}" dy="0em">${rows[0]}</tspan>`;
      return html;
    })
    .attr('transform', function(d, i) {
      const elAngle = getNewAngle(d, i, config);
      return `rotate(${elAngle}) translate(0, ${-r})`;
    })
    .on('mouseenter', function(d, i) {
      const el = d3.select(this);
      const tooltip = isNaN(+config.customSegmentLabels[i])
        ? config.customSegmentLabels[i]
        : labelFormat(config.customSegmentLabels[i]);
      const html = `
    <span class="key"> 
      ${tooltip}
    </span> 
  `;
      el.classed('hover', true);
      el.style('font-size', '15px');

      html && onShowTooltip(html);
    })
    .on('mouseout', function(d, i) {
      const el = d3.select(this);
      el.classed('hover', false);
      el.style('font-size', '14px');
      onHideTooltip();
    })
    .on('mousemove', function() {
      onMoveTooltip(speedometer.node().parentNode);
    });
}

function configureArcHover(config) {
  const tickData = configureTickData(config);
  const range = config.maxAngle - config.minAngle;
  const r = getRadius(config);
  const arc = (index) => {
    return d3arc()
      .innerRadius(r - config.ringWidth - config.ringInset - 5)
      .outerRadius(r - config.ringInset + 5)
      .startAngle(() => {
        const ratio = sumArrayTill(tickData, index);
        return deg2rad(config.minAngle + ratio * range);
      })
      .endAngle(() => {
        const ratio = sumArrayTill(tickData, index + 1);
        return deg2rad(config.minAngle + ratio * range);
      });
  };
  return arc;
}

function configureTickData(config) {
  const defaultTickData = d3Range(config.segments).map((d) => {
    return 1 / config.segments;
  });
  const tickData = calculateSegmentStops({
    tickData: defaultTickData,
    customSegmentStops: config.customSegmentStops,
    min: config.minValue,
    max: config.maxValue,
  });
  return tickData;
}

function configureArc(config) {
  const tickData = configureTickData(config);
  const range = config.maxAngle - config.minAngle;
  const r = getRadius(config);
  const arc = (index = null) => {
    return d3arc()
      .innerRadius(r - config.ringWidth - config.ringInset)
      .outerRadius(r - config.ringInset)
      .startAngle((d, i) => {
        const ratio = sumArrayTill(tickData, index || i);
        return deg2rad(config.minAngle + ratio * range);
      })
      .endAngle((d, i) => {
        const ratio = sumArrayTill(tickData, (index || i) + 1);
        return deg2rad(config.minAngle + ratio * range);
      });
  };

  return arc;
}

function configureTooltipLabels(config) {
  const { segmentLabels, segmentColors } = config;
  const label = (index) => {
    if (
      typeof segmentLabels[index] === 'undefined' ||
      segmentLabels[index] === null
    )
      return null;
    let html = `
    <span style="display: flex; align-items : center;">
      <span 
        class="legend-color-guide"
        style="
          background-color: ${segmentColors[index]}; 
          width: 15px; 
          height: 15px; 
          border: 1px solid #999; 
          display: inline-block; 
          margin-right: 5px;">
      </span>
      <span class="key"> 
        ${segmentLabels[index]} 
      </span> 
    </span>
    `;

    return html;
  };

  return label;
}

function showTooltip(Tooltip) {
  return (htmlContent = null) => {
    htmlContent && Tooltip.html(htmlContent).style('opacity', 1);
    d3.select(this)
      .style('stroke', 'black')
      .style('opacity', 1)
      .style('pointer-events', 'auto');
  };
}

function moveTooltip(Tooltip) {
  return (d) => {
    const [mouseLeft, mouseTop] = d3.mouse(d);
    Tooltip.style('left', mouseLeft + 20 + 'px').style(
      'top',
      mouseTop - 10 + 'px'
    );
  };
}

function hideTooltip(Tooltip) {
  return () => {
    Tooltip.style('opacity', 0)
      .select(this)
      .style('stroke', 'none')
      .style('opacity', 0.8);
  };
}

function initTooltip({ parent }) {
  d3.select(parent).style('position', 'relative');
  return d3
    .select(parent)
    .append('span')
    .style('opacity', 0)
    .style('background-color', 'rgba(255,255,255,.8)')
    .style('border', '1px solid rgba(0,0,0,.5)')
    .style('border-radius', '4px')
    .style('padding', '5px')
    .style('position', 'absolute')
    .style('display', 'flex')
    .style('pointer-events', 'none');
}

function configureScale(config) {
  return calculateScale({
    min: config.minValue,
    max: config.maxValue,
    segments: config.maxSegmentLabels,
  });
}

function calculateScale({ min, max }) {
  return d3.scale
    .linear()
    .range([0, 1])
    .domain([min, max]);
}

// функция для вычисления максимальной длины лейблов спидометра
function getMaxLabelLength(config, arcs) {
  const r =
    config.labelPosition === 'OUTSIDE'
      ? getRadius(config) - 20
      : getRadius(config) - 110;
  const arrayOfHalfsArcLength = [];
  const maxLabelLengths = [];
  const ArrayOfdiff = [];
  const StartEnd = Math.abs(r * Math.sin(deg2rad(-5)))
  arcs.each((d, i) => {
    const ang = getAngle(config, i);
    // const HalfArcsLength = (( ang * r * Math.PI )/ 180)/2
    let HalfArcsLength = Math.abs(r * Math.sin(deg2rad(ang / 2)));
    arrayOfHalfsArcLength.push(HalfArcsLength);
  });
  arrayOfHalfsArcLength.forEach((length, index) => {
    const direction = length - arrayOfHalfsArcLength[index + 1];
    if (index === 0) {
      maxLabelLengths.push(Math.ceil(StartEnd * 2));
      length < StartEnd ?
      ArrayOfdiff.push({
        minArcLength: length * 2,
        direction: -1,
      }):
      ArrayOfdiff.push({
        minArcLength: StartEnd * 2,
        direction: -1,
      });
    }
    if (index === arrayOfHalfsArcLength.length - 1) {
      maxLabelLengths.push(Math.ceil(StartEnd * 2));
      length < StartEnd ?
      ArrayOfdiff.push({
        minArcLength: length * 2,
        direction: -1,
      }):
      ArrayOfdiff.push({
        minArcLength: StartEnd * 2,
        direction: -1,
      })
    } else {
      maxLabelLengths.push(
        Math.ceil((length + arrayOfHalfsArcLength[index + 1]) * 0.75)
      );
      length < arrayOfHalfsArcLength[index + 1]
        ? ArrayOfdiff.push({
            minArcLength: length * 2,
            direction,
          })
        : ArrayOfdiff.push({
            minArcLength: arrayOfHalfsArcLength[index + 1] * 2,
            direction,
          });
    }
  });
  return { maxLabelLengths, ArrayOfdiff };
}

function getLabelText(i, config, maxElWidth, labelFormat) {
  const minWidth = getElWidth('hhhhh');
  const customLabel =
    config.customSegmentLabels[i] &&
    config.customSegmentLabels[i].toString().trim();
  const text = isNaN(+customLabel) ? customLabel : labelFormat(customLabel);
  const words = text.toString().split(' ');
  const isTextCanBeWrapped = words.some(
    (word) =>
      (word && word.toString().length > MAX_CHAR_COUNT) ||
      getElWidth(word) > maxElWidth
  );
  const fixedWords = words.map((word) => (maxElWidth < minWidth ? '' : word));
  return { fixedWords, isTextCanBeWrapped };
}

function cutLabel(elText, chars, maxElWidth) {
  const elWidth = getElWidth(elText);
  return elWidth > maxElWidth ||
    (elText && elText.toString().split('').length > MAX_CHAR_COUNT)
    ? chars.pop() && cutLabel(chars.join(''), chars, maxElWidth)
    : chars.pop() && chars.push('..');
}

function getElWidth(elText) {
  return _getWidthOfText(elText, 'Helvetica, Arial', 14);
}

function _getWidthOfText(txt, fontname, fontsize) {
  if (_getWidthOfText.e === undefined) {
    _getWidthOfText.e = document.createElement('div');
    _getWidthOfText.e.style.display = 'none';
    document.body.appendChild(_getWidthOfText.e);
  }
  _getWidthOfText.e.style.fontSize = fontsize;
  _getWidthOfText.e.style.fontFamily = fontname;
  _getWidthOfText.e.innerText = txt;
  return $(_getWidthOfText.e).width();
}

function getAngle(config, index) {
  const range = config.maxAngle - config.minAngle;
  const tickData = configureTickData(config);
  const ratioStart = sumArrayTill(tickData, index);
  const ratioEnd = sumArrayTill(tickData, index + 1);
  const angStart = config.minAngle + ratioStart * range;
  const angEnd = config.minAngle + ratioEnd * range;
  return angEnd - angStart;
}

function deg2rad(deg) {
  return (deg * Math.PI) / 180;
}

function getRadius(config) {
  return config.width / 2;
}

function getInnerRadius(config) {
  return config.width / 2 - config.ringWidth - config.ringInset;
}

function getNewAngle(tick, i, config) {
  const range = config.maxAngle - config.minAngle;
  const ratio =
    config.customSegmentStops.length === 0
      ? configureScale(tick)
      : sumArrayTill(configureTickData(config), i);
  const newAngle = config.minAngle + ratio * range;
  return newAngle;
}

function sumArrayTill(array, index) {
  return sum(take(index)(array));
}

function calculateSegmentStops({ tickData, customSegmentStops, min, max }) {
  if (!isArray(customSegmentStops) || isEmpty(customSegmentStops)) {
    // return existing tick data
    return tickData;
  }
  // there is some custom segment stop
  // let us do the validation

  // first element should be equivalent to min
  if (head(customSegmentStops) !== min) {
    throw new Error(
      `First value should be equivalent to min value given. Current min value - ${min}`
    );
  }

  // last element shuold be equivalent to max
  if (last(customSegmentStops) !== max) {
    throw new Error(
      `Last value should be equivalent to max value given. Current min value - ${max}`
    );
  }

  // looks like we have a valid custom segment stop, let us massage the data
  // construct the relative difference values
  const relative_difference = customSegmentStops.map((current_stop, index) => {
    if (index === 0) {
      // ignore
      return;
    }
    return (current_stop - customSegmentStops[index - 1]) / (max - min);
  });

  return drop(relative_difference);
}

function calculateNeedleHeight({ heightRatio, radius }) {
  if (heightRatio < 0 || heightRatio > 1) {
    throw new Error(`Invalid needleHeightRatio given - ${heightRatio}`);
  }
  return Math.round(radius * heightRatio);
}

function getMaxOfArray(numArray) {
  return Math.max.apply(null, numArray)
}

function centerTranslation(r) {
  return `translate(${r}, ${r})`;
}
