import d3 from 'd3';
import dist from 'distributions';

import React from 'react';
import { Table, Tr, Td, Thead, Th } from 'reactable';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { t } from '../javascripts/locales';


import './paired_ttest.css';
import chordViz from "./chord";

const CONTROL = 'control';
const INVALID = 'invalid';

class TTestTable extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      pValues: [],
      liftValues: [],
      control: 0,
    };
  }

  componentWillMount() {
    this.computeTTest(this.state.control); // initially populate table
  }

  getLiftStatus(row) {
    // Get a css class name for coloring
    if (row === this.state.control) {
      return CONTROL;
    }
    const liftVal = this.state.liftValues[row];
    if (isNaN(liftVal) || !isFinite(liftVal)) {
      return INVALID; // infinite or NaN values
    }
    return liftVal >= 0 ? 'true' : 'false'; // green on true, red on false
  }

  getPValueStatus(row) {
    if (row === this.state.control) {
      return CONTROL;
    }
    const pVal = this.state.pValues[row];
    if (isNaN(pVal) || !isFinite(pVal)) {
      return INVALID;
    }
    return ''; // p-values won't normally be colored
  }

  getSignificance(row) {
    // Color significant as green, else red
    if (row === this.state.control) {
      return CONTROL;
    }
    // p-values significant below set threshold
    return this.state.pValues[row] <= this.props.alpha;
  }

  computeLift(values, control) {
    // Compute the lift value between two time series
    let sumValues = 0;
    let sumControl = 0;
    for (let i = 0; i < values.length; i++) {
      sumValues += values[i].y;
      sumControl += control[i].y;
    }
    return (((sumValues - sumControl) / sumControl) * 100)
      .toFixed(this.props.liftValPrec);
  }

  computePValue(values, control) {
    // Compute the p-value from Student's t-test
    // between two time series
    let diffSum = 0;
    let diffSqSum = 0;
    let finiteCount = 0;
    for (let i = 0; i < values.length; i++) {
      const diff = control[i].y - values[i].y;
      if (global.isFinite(diff)) {
        finiteCount++;
        diffSum += diff;
        diffSqSum += diff * diff;
      }
    }
    const tvalue = -Math.abs(diffSum *
      Math.sqrt((finiteCount - 1) /
      (finiteCount * diffSqSum - diffSum * diffSum)));
    try {
      return (2 * new dist.Studentt(finiteCount - 1).cdf(tvalue))
        .toFixed(this.props.pValPrec); // two-sided test
    } catch (err) {
      return NaN;
    }
  }

  computeTTest(control) {
    // Compute lift and p-values for each row
    // against the selected control
    const data = this.props.data;
    const pValues = [];
    const liftValues = [];
    if (!data) {
      return;
    }
    for (let i = 0; i < data.length; i++) {
      if (i === control) {
        pValues.push(CONTROL);
        liftValues.push(CONTROL);
      } else {
        pValues.push(this.computePValue(data[i].values, data[control].values));
        liftValues.push(this.computeLift(data[i].values, data[control].values));
      }
    }
    this.setState({ pValues, liftValues, control });
  }

  processValue(value) {
    if (value === CONTROL) {
      return t(CONTROL);
    } else if (typeof value === 'boolean') {
      return t(`${value}`)
    } else if (isNaN(value)) {
      return 'неверное значение'
    }

    return value;
  }

  render() {
    const data = this.props.data;
    const metric = this.props.metric;
    const metricVerbose = this.props.metrics.find(item => item.metric_name === metric)
        ? this.props.metrics.find(item => item.metric_name === metric).verbose_name
        : metric;
    const groups = this.props.groups;
    // Render column header for each group
    const columns = groups.map((group, i) => (
      <Th key={i} column={group}>{group}</Th>
    ));
    const numGroups = groups.length;
    // Columns for p-value, lift-value, and significance (true/false)
    columns.push(<Th key={numGroups + 1} column="pValue">{t('p-value')}</Th>);
    columns.push(<Th key={numGroups + 2} column="liftValue">{t('Lift %')}</Th>);
    columns.push(<Th key={numGroups + 3} column="significant">{t('Significant')}</Th>);
    const rows = data.map((entry, i) => {
      const values = groups.map((group, j) => ( // group names
        <Td key={j} column={group} data={entry.group[j]} />
      ));
      values.push(
        <Td
          key={numGroups + 1}
          className={this.getPValueStatus(i)}
          column="pValue"
          data={this.processValue(this.state.pValues[i])}
        />,
      );
      values.push(
        <Td
          key={numGroups + 2}
          className={this.getLiftStatus(i)}
          column="liftValue"
          data={this.processValue(this.state.liftValues[i])}
        />,
      );
      values.push(
        <Td
          key={numGroups + 3}
          className={this.getSignificance(i)}
          column="significant"
          data={this.processValue(this.getSignificance(i))}
        />,
      );
      return (
        <Tr
          key={i}
          onClick={this.computeTTest.bind(this, i)}
          className={i === this.state.control ? CONTROL : ''}
        >
          {values}
        </Tr>
      );
    });
    // When sorted ascending, 'control' will always be at top
    const sortConfig = groups.concat([
      {
        column: 'pValue',
        sortFunction: (a, b) => {
          if (a === CONTROL) {
            return -1;
          }
          if (b === CONTROL) {
            return 1;
          }
          return a > b ? 1 : -1; // p-values ascending
        },
      },
      {
        column: 'liftValue',
        sortFunction: (a, b) => {
          if (a === CONTROL) {
            return -1;
          }
          if (b === CONTROL) {
            return 1;
          }
          return parseFloat(a) > parseFloat(b) ? -1 : 1; // lift values descending
        },
      },
      {
        column: 'significant',
        sortFunction: (a, b) => {
          if (a === CONTROL) {
            return -1;
          }
          if (b === CONTROL) {
            return 1;
          }
          return a > b ? -1 : 1; // significant values first
        },
      },
    ]);
    return (
      <div>
        <h3>{metricVerbose}</h3>
        <Table
          className="table"
          id={`table_${metric}`}
          sortable={sortConfig}
        >
          <Thead>
            {columns}
          </Thead>
          {rows}
        </Table>
      </div>
    );
  }
}

TTestTable.propTypes = {
  metric: PropTypes.string.isRequired,
  groups: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  alpha: PropTypes.number.isRequired,
  liftValPrec: PropTypes.number.isRequired,
  pValPrec: PropTypes.number.isRequired,
  metrics: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
};
TTestTable.defaultProps = {
  metric: '',
  groups: [],
  data: [],
  alpha: 0.05,
  liftValPrec: 4,
  pValPrec: 6,
};

function pairedTTestVis(slice, payload) {
  const div = d3.select(slice.selector);
  const container = slice.container;
  const height = slice.container.height();
  const fd = slice.formData;
  const data = payload.data;
  const alpha = fd.significance_level;
  const pValPrec = fd.pvalue_precision;
  const liftValPrec = fd.liftvalue_precision;
  const tables = fd.metrics.map((metric, i) => ( // create a table for each metric
    <TTestTable
      key={i}
      metric={metric}
      groups={fd.groupby}
      data={data[metric]}
      alpha={alpha}
      pValPrec={pValPrec > 32 ? 32 : pValPrec}
      liftValPrec={liftValPrec > 32 ? 32 : liftValPrec}
      columns={slice.columns}
      metrics={slice.metrics}
    />
  ));
  div.html('');
  ReactDOM.render(
    <div className="row">
      <div className="col-sm-12">
        <div className="paired-ttest-table scrollbar-container">
          <div className="scrollbar-content">
            {tables}
          </div>
        </div>
      </div>
    </div>,
    div.node(),
  );
  container.find('.scrollbar-container').css('max-height', height);
}

export default pairedTTestVis;
