/* eslint-disable no-param-reassign */
import d3 from "d3";
import contextmenu from "d3-context-menu";
import { Hierarchy } from "../utils/hierarchy";
import { SOURCE, TARGET, COMMON } from "../constants/common";
import { contextMenuEnabled } from "../utils/context_menu";
import { directedForceDDVisualization } from "./helpers/ddVisualization/directedForceDD";
import "./directed_force.css";
import "d3-context-menu/css/d3-context-menu.css";
import { d3TimeFormatPreset } from "../javascripts/modules/utils";

contextmenu(d3);

/* Modified from http://bl.ocks.org/d3noob/5141278 */
const directedForceVis = function(slice, json) {
  const div = d3.select(slice.selector);
  const width = slice.width();
  const height = slice.height();
  const fd = slice.formData;
  // удаленно 18.10 , не используется (ст 21-25)
  const { utc_offset } = json;
  const tsFormatter = d3TimeFormatPreset(fd.date_time_format, utc_offset);
  const linkLength = fd.link_length || 200;
  const charge = fd.charge || -500;

    const menu = (data) => {
        let type;

    if (data.val) {
      const dataList = [...json.data];
      const sources = dataList.map((d) => d.source.name);
      const targets = dataList.map((d) => d.target.name);

            if (sources.indexOf(data.name) !== -1 && targets.indexOf(data.name) !== -1) {
                type = COMMON;
            } else {
                type = TARGET;
            }
        } else {
            type = SOURCE;
        }

        const hierarcyManager = new Hierarchy(slice, json, { type });
        const cols = json.form_data.groupby;

    const contextFilters = [
      {
        conjuction: "and",
        col: "",
        val: "",
        op: "in",
        children: cols.map((col) => ({
          op: "in",
          conjuction: "or",
          col,
          val: [data.name],
        })),
      },
    ];

        const urlDrilldowns = hierarcyManager.getUrlDrilldowns(fd.metric, contextFilters);

        const hierarchyDrilldowns = [];

    json.hierarchy.forEach((h) => {
      if (slice.formData.disabled_hierarchy.findIndex((dh) => dh === h.id) !== -1) {
        return;
      }

      const attr = slice.formData.groupby ? "groupby" : "all_columns";

      const currentHierarchyDrilldown = [];
      const mapColumnToDrilldown = (hierarchyColumn) => {
        const columnIndexFormData = slice.formData[attr].indexOf(hierarchyColumn.name);
        const hierarchyColumnActive = columnIndexFormData !== -1;
        const drilldown = {
          id: hierarchyColumn.id,
          order: hierarchyColumn.order,
          title: !hierarchyColumnActive
            ? hierarchyColumn.verbose_name || hierarchyColumn.name
            : `<i class="fa fa-check" aria-hidden="true"></i>  ${hierarchyColumn.verbose_name || hierarchyColumn.name}`,
          action:
            columnIndexFormData === 0 || !contextMenuEnabled()
              ? () => {}
              : () => {
                  // top level column can't be revert
                  hierarcyManager.drilldownToHierarchy(
                    hierarchyColumn,
                    contextFilters,
                    hierarchyColumnActive,
                    attr,
                    h.columns,
                    []
                  );
                },
        };
        return drilldown;
      };

      const nextColumns = h.columns
        .filter((hierarchyColumn) => slice.formData[attr].includes(hierarchyColumn.name))
        .map((hierarchyColumn) => hierarcyManager.getNextColumnByHierarchy(h, hierarchyColumn))
        .filter((item) => item);

      nextColumns.forEach((item) => {
        currentHierarchyDrilldown.push(mapColumnToDrilldown(item));
      });

            if (currentHierarchyDrilldown.length) {
                // eslint-disable-next-line no-inner-declarations
                function createHierarchyList() {
                    hierarchyDrilldowns.push({ title: h.verbose_name || h.name });
                    currentHierarchyDrilldown.forEach((item) => {
                        hierarchyDrilldowns.push(item);
                    });
                }

        if (type === COMMON) {
          createHierarchyList();
        } else {
          h.columns.forEach((c) => {
            if (c.name.includes(fd.groupby[type - 1])) createHierarchyList();
          });
        }
      }
    });

    return [...hierarchyDrilldowns, ...urlDrilldowns];
  };

  const links = json.data;
  const nodes = {};

  const sourceColName = slice.datasource.columns.find((column) => column.column_name === json.form_data.groupby[0]);
  const targetColName = slice.datasource.columns.find((column) => column.column_name === json.form_data.groupby[1]);

  // Compute the distinct nodes from the links.
  links.forEach(function(link) {
    let linkSourceName = typeof link.source === "string" ? link.source : link.source?.name || link.source;
    let linkTargetName = typeof link.target === "string" ? link.target : link.target?.name || link.target;

    linkSourceName = typeof linkSourceName === "object" ? null : linkSourceName;
    linkTargetName = typeof linkTargetName === "object" ? null : linkTargetName;

    link.source =
      nodes[linkSourceName] ||
      (nodes[linkSourceName] = {
        name: linkSourceName,
      });
    link.target =
      nodes[linkTargetName] ||
      (nodes[linkTargetName] = {
        name: linkTargetName,
      });
    link.value = Number(link.value);
    const targetName = link.target.name;
    const sourceName = link.source.name;
    if (nodes[targetName].total === undefined) {
      nodes[targetName].total = link.value;
    }
    if (nodes[sourceName].total === undefined) {
      nodes[sourceName].total = 0;
    }
    if (nodes[targetName].max === undefined) {
      nodes[targetName].max = 0;
    }
    if (link.value > nodes[targetName].max) {
      nodes[targetName].max = link.value;
    }
    if (nodes[targetName].min === undefined) {
      nodes[targetName].min = 0;
    }
    if (link.value > nodes[targetName].min) {
      nodes[targetName].min = link.value;
    }
    nodes[targetName].total += link.value;
    nodes[targetName].val = sourceName;

    if (sourceColName.is_dttm) {
      nodes[sourceName].format_data = sourceName;
    }
    if (targetColName.is_dttm) {
      nodes[targetName].format_data = targetName;
    }
  });

  /* eslint-disable no-use-before-define */
  // add the curvy lines
  function tick() {
    path.attr("d", function(d) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy);
      return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
    });

    node.attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  }
  /* eslint-enable no-use-before-define */
  const force = d3.layout
    .force()
    .nodes(d3.values(nodes))
    .links(links)
    .size([width, height])
    .linkDistance(linkLength)
    .charge(charge)
    .on("tick", tick)
    .start();

  div.selectAll("*").remove();
  const svg = div
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // build the arrow.
  svg
    .append("svg:defs")
    .selectAll("marker")
    .data(["end"]) // Different link/path types can be defined here
    .enter()
    .append("svg:marker") // This section adds in the arrows
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", -1.5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");

  const edgeScale = d3.scale.linear().range([0.1, 0.5]);
  // add the links and the arrows
  const path = svg
    .append("svg:g")
    .selectAll("path")
    .data(force.links())
    .enter()
    .append("svg:path")
    .attr("class", "link")
    .style("opacity", function(d) {
      return edgeScale(d?.value / d.target.max);
    })
    .attr("marker-end", "url(#end)");

  // define the nodes
  const node = svg
    .selectAll(".node")
    .data(force.nodes())
    .enter()
    .append("g")
    .attr("class", "node")
    .on("mouseenter", function() {
      d3.select(this)
        .select("circle")
        .transition()
        .style("stroke-width", 5);

      d3.select(this)
        .select("text")
        .transition()
        .style("font-size", 25);
    })
    .on("mouseleave", function() {
      d3.select(this)
        .select("circle")
        .transition()
        .style("stroke-width", 1.5);
      d3.select(this)
        .select("text")
        .transition()
        .style("font-size", 12);
    })
    .classed("contextMenuCursor", (data) => {
      const items = menu(data);
      return !!items.length;
    })
    .on("contextmenu", (data) => {
      const items = menu(data);
      if (items.length) {
        d3.contextMenu(() => items)();
      }
    })
    .call(force.drag);

  // add the nodes
  const ext = d3.extent(d3.values(nodes), function(d) {
    return Math.sqrt(d.total);
  });
  const circleScale = d3.scale
    .linear()
    .domain(ext)
    .range([3, 30]);

  node.append("circle").attr("r", function(d) {
    return circleScale(Math.sqrt(d.total));
  });

  // add the text
  node
    .append("text")
    .attr("x", 6)
    .attr("dy", ".35em")
    .text(function(d) {
      if (d.format_data) {
        return tsFormatter(d.format_data);
      }

      return d.name;
    });

  // визуализация DD
  directedForceDDVisualization(slice);
};

export default directedForceVis;
