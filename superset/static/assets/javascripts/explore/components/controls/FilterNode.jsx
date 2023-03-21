import React, { PropTypes } from "react";
import { Button } from "react-bootstrap";
import shortid from "shortid";
import FilterWithGroup from "./FilterWithGroup";
import "./FilterNode.css";
import { t } from "../../../locales";

const switchValThenChangeOp = (filter, control, value, item) => {
  const isArr = (operator) => (operator === 'in' || operator === 'not in');
  //arr to string
  const replaceInString = isArr(item.op) && !isArr(value);
  //string to arr
  const replaceInArr = !isArr(item.op) && isArr(value);
  //arr to arr
  const allArr = !!(!isArr(item.op) && !isArr(value));

  if(control === "op" && (replaceInArr || replaceInString)) {

    let newVal;
    if(replaceInString && !allArr) {
      newVal = item.val[0];
    }
    if(replaceInArr && !allArr) {
      newVal = [item.val];
    }
    return {
      ...filter,
      val: newVal,
      [control]: value
    };
  } else {
    return {
      ...filter,
      [control]: value
    };
  }
};

function findParent(filter, values) {
  if(!filter.path || (filter.path && !filter.path.length)) {
    return null;
  }
  return filter.path.reduce(
    (prev, next) => prev.children.find(item => item.id === next),
    { children: values });
}

function insertAfter(filters, filter, referenceFilter) {
  const result = [];
  filters.forEach((item) => {
    result.push(item);
    if(item.id === referenceFilter.id) {
      result.push(filter);
    }
  });
  return result;
}

function removeNodeRecursive(node, values) {
  if(node.children.length) {
    return values;
  }
  if(!node.path.length) {
    return values.filter(item => item.id !== node.id);
  }
  const parent = findParent(node, values);
  if(!parent) {
    return values;
  }
  parent.children = parent.children.filter(item => item.id !== node.id);
  return removeNodeRecursive(parent, values);
}

function removeNode(filter, values) {
  const result = [...values];
  if(filter.path && !filter.path.length) {
    return result.filter(item => item.id !== filter.id);
  }
  const parent = findParent(filter, result);
  parent.children = parent.children.filter(item => item.id !== filter.id);
  return removeNodeRecursive(parent, values);
}

/* Update filter's path to match his position as newRoot child;
 * All filter's children update their paths accordingly.
 */
function updatePath(filter, newRoot) {
  const newFilter = { ...filter, path: newRoot ? [...newRoot.path, newRoot.id] : [] };
  return {
    ...newFilter,
    children: (filter.children) ? filter.children.map(item => updatePath(item, newFilter)) : null
  };
}

export class FilterNode extends React.Component {
  constructor(props) {
    super(props);
    this.changeFilter = this.changeFilter.bind(this);
    this.addFilter = this.addFilter.bind(this);
    this.removeFilter = this.removeFilter.bind(this);
    this.handleMakeNode = this.handleMakeNode.bind(this);
    this.handleConjuctionChange = this.handleConjuctionChange.bind(this);
  }

  componentWillMount() {
    const { filter, value, onChange } = this.props;
    // restore id if back returns filters without them
    if(filter && !filter.id) {
      const values = [...value];
      const parent = findParent(filter, values);
      if(!parent) {
        onChange(values.map(item => (item.id === filter.id)
          ? {
            ...item,
            id: shortid.generate(),
            path: []
          }
          : item
        ));
        return;
      }
      if(parent) {
        parent.children = parent.children.map(item => item.id === filter.id
          ? { ...item, id: shortid.generate() }
          : item
        );
        onChange(values);
      }
    }
  }

  changeFilter(filter, control, value) {
    const values = [...this.props.value];
    const parent = findParent(filter, values);
    if(!parent) {
      this.props.onChange(values.map(item => item.id === filter.id
        ? switchValThenChangeOp(filter, control, value, item)
        : item
      ));
      return;
    }
    parent.children = parent.children.map(item => item.id === filter.id
      ? switchValThenChangeOp(filter, control, value, item)
      : item
    );
    this.props.onChange(values);
  }

  addFilter() {
    const filter = this.props.filter;
    const values = [...this.props.value];
    const parent = findParent(filter, values);
    const newFilter = {
      id: shortid.generate(),
      col: null,
      op: "in",
      val: "",
      conjuction: "and",
      path: parent ? [...filter.path] : []
    };
    if(!parent) {
      this.props.onChange(insertAfter(values, newFilter, filter));
      return;
    }
    parent.children = insertAfter(parent.children, newFilter, filter);
    this.props.onChange(values);
  }

  removeFilter() {
    const values = [...this.props.value];
    const filter = this.props.filter;
    const result = removeNode(filter, values);
    this.props.onChange(result);
  }

  handleMakeNode(filter) {
    let values = [...this.props.value];
    const parentNode = findParent(filter, this.props.value);
    if(!parentNode) {
      values = values.map(item => item.id === filter.id
        ? {
          id: item.id,
          path: item.path || [],
          conjuction: item.conjuction,
          children: [{
            ...filter,
            id: shortid.generate(),
            path: [item.id]
          }]
        }
        : item
      );
    } else {
      parentNode.children = parentNode.children.map(item => item.id === filter.id
        ? {
          id: item.id,
          path: item.path,
          conjuction: item.conjuction,
          children: [{
            ...filter,
            id: shortid.generate(),
            path: [...item.path, item.id]
          }]
        }
        : item
      );
    }
    this.props.onChange(values);
  }

  handleConjuctionChange(filter, conjuction) {
    const values = [...this.props.value];
    const parent = findParent(filter, values);
    if(!parent) {
      this.props.onChange(values
        .map(value => value.id === filter.id
          ? { ...value, conjuction }
          : value
        )
      );
      return;
    }
    parent.children = parent.children.map(item => item.id === filter.id
      ? { ...filter, conjuction }
      : item
    );
    this.props.onChange(values);
  }

  handleTakeFromNode(filter) {
    const values = [...this.props.value];
    const parent = findParent(filter, values);
    const prevFilter = parent.children[parent.children
      .indexOf(parent.children
        .find(item => item.id === filter.id)) - 1
      ];
    const conjuction = prevFilter ? prevFilter.conjuction : "and";
    parent.children = parent.children.filter(item => item.id !== filter.id);
    const grandParent = findParent(parent, values);
    if(!grandParent) {
      const insertAfterIndex = values.indexOf(values.find(item => item.id === parent.id));
      const movedFilter = updatePath(filter);
      const newValues = [
        ...values.slice(0, insertAfterIndex + 1),
        movedFilter,
        ...values.slice(insertAfterIndex + 1)
      ]
        .filter(item => !item.children || item.children && item.children.length)
        .map((item, index) => index === insertAfterIndex
          ? { ...item, conjuction }
          : item
        );
      this.props.onChange(newValues);
      return;
    }
    const insertAfterIndex = grandParent.children
      .indexOf(grandParent.children.find(item => item.id === parent.id));
    const movedFilter = updatePath(filter, grandParent);
    grandParent.children = [
      ...grandParent.children.slice(0, insertAfterIndex + 1),
      movedFilter,
      ...grandParent.children.slice(insertAfterIndex + 1)
    ]
      .filter(item => !item.children || item.children && item.children.length)
      .map((item, index) => index === insertAfterIndex
        ? { ...item, conjuction }
        : item
      );
    this.props.onChange(values);
  }

  render() {
    const { name, datasource, groups } = this.props;
    const { filter, controlsActive, ...others } = this.props;
    return (
      <div>
        <div className="node-card">
          {filter.children &&
            <div className="node-children">
              {filter.children.map((item, index) => (
                <FilterNode
                  key={item.id}
                  filter={item}
                  controlsActive={index !== filter.children.length - 1}
                  {...others}
                />
              ))}
            </div>
          }
          {!filter.children &&
            <div>
              <FilterWithGroup
                having={name === "having_filters"}
                filter={filter}
                datasource={datasource}
                removeFilter={this.removeFilter}
                changeFilter={(control, val) => this.changeFilter(filter, control, val)}
                groups={groups}
              />
              <div className="node-controls-make">
                <Button
                  id="add-button"
                  bsSize="sm"
                  onClick={() => this.handleMakeNode(filter)}
                >
                  <i className="fa fa-arrow-right" /> &nbsp; {t("Take in")}
                </Button>
              </div>
            </div>
          }
        </div>
        <div className="node-controls">
          <div className="node-controls-add">
            <Button
              id="add-button"
              bsSize="sm"
              onClick={this.addFilter}
            >
              <i className="fa fa-plus" /> &nbsp; {t("Add Filter")}
            </Button>
            {filter.path && !!filter.path.length &&
              <Button
                id="add-button"
                bsSize="sm"
                onClick={() => this.handleTakeFromNode(filter)}
              >
                <i className="fa fa-arrow-left" /> &nbsp; {t("Take out")}
              </Button>
            }
          </div>
          {controlsActive &&
            <div className="node-controls-conjuction">
              <Button
                bsSize="sm"
                bsStyle={(filter.conjuction === "and" || !filter.conjuction) ? "primary" : "default"}
                onClick={() => this.handleConjuctionChange(filter, "and")}
              >
                {t("AND")}
              </Button>
              <Button
                bsSize="sm"
                bsStyle={filter.conjuction === "or" ? "primary" : "default"}
                onClick={() => this.handleConjuctionChange(filter, "or")}
              >
                {t("OR")}
              </Button>
            </div>
          }
        </div>
      </div>
    );
  }
}

FilterNode.propTypes = {
  name: PropTypes.string,
  value: PropTypes.array,
  filter: PropTypes.object.isRequired,
  datasource: PropTypes.object,
  controlsActive: PropTypes.bool,
  onChange: PropTypes.func
};

FilterNode.defaultProps = {
  onChange: () => {
  },
  value: []
};

export default FilterNode;
