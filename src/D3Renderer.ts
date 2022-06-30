import { bindDragAndDrop, bindSelectNode, bindZoomAndPan } from "./events.js";
import { D3Simulation } from "./D3Simulation";
import { DataType, LinkType, NodeType } from "./model/data";
import { Config } from "./model/config";
import { bindMouseOverLink } from "./hover";

// @ts-ignore
const { create } = d3;

export class D3Renderer {
  readonly #config: Config;
  #svg;
  #nodes;
  #links;
  #linkHovers;
  readonly #simulation: D3Simulation;
  readonly #data: DataType;

  constructor(config: Config, data: DataType) {
    this.#config = config;
    this.#data = data;
    this.#simulation = new D3Simulation(config);
    this.#simulation.onTick(() => this.#tick());
    this.#simulation.onEnd(() => this.#updateHoversRegions());
  }

  build() {
    this.#svg = buildSvg(this.#config);
    this.#links = buildLinks(this.#config, this.#svg);
    this.#nodes = buildNodes(this.#config, this.#svg);
    bindZoomAndPan(this.#svg);
  }

  #updateNodes(nodes: NodeType[]) {
    this.#nodes.on(".", null);
    this.#nodes.remove();
    this.#nodes = buildNodes(this.#config, this.#svg, nodes);
    bindDragAndDrop(this.#nodes, this.#simulation);
    bindSelectNode(this.#nodes, this.#data);
  }

  #updateLinks(links: LinkType[]) {
    this.#links.on(".", null);
    this.#links.remove();
    this.#links = buildLinks(this.#config, this.#svg, links);
    this.#linkHovers = buildHovers(this.#config, this.#svg, links);
    bindMouseOverLink(this.#links, this.#data);
  }

  #tick() {
    this.#links.attr("d", (d) => linkArc(this.#config, d));
    this.#nodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
  }

  get htmlEl() {
    return this.#svg.node();
  }

  refresh() {
    this.#updateNodes(this.#data.nodes);
    this.#updateLinks(this.#data.links);
    this.#simulation.resetData(this.#data.nodes, this.#data.links);
  }

  #updateHoversRegions() {
    this.#linkHovers.attr("d", (d) => linkArc(this.#config, d));
  }
}

function buildSvg({ width, height }: Config) {
  const svg = create("svg").attr("id", "nms-graph").attr("viewBox", [0, 0, width, height]);
  addArrowHeadDefs(svg);
  return svg;
}

function addArrowHeadDefs(svg) {
  const defs = svg.append("defs");

  defs
    .append("marker")
    .attr("id", `arrow-basic`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 8)
    .attr("refY", 0)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", `#7f7f7f`)
    .attr("d", "M0,-5L10,0L0,5");

  defs
    .append("marker")
    .attr("id", `arrow-highlight`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 8)
    .attr("refY", 0)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", `#f8bc63`)
    .attr("d", "M0,-5L10,0L0,5");
  return svg;
}

function buildLinks({}: Config, svg, data: LinkType[] = []) {
  let linksGroup = svg.select(".links");
  if (linksGroup.empty()) {
    linksGroup = svg.append("g").classed("links", true);
  }

  return linksGroup
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("data-target", (d) => d.target);
}

function buildHovers({}: Config, svg, data: LinkType[] = []) {
  let linksGroup = svg.select(".linkHovers");
  if (linksGroup.empty()) {
    linksGroup = svg.append("g").classed("linkHovers", true);
  }

  return linksGroup
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("data-target", (d) => d.target);
}

function buildNodes({ iconSize }: Config, svg, data: NodeType[] = []) {
  let nodeGroup = svg.select(".nodes");
  if (nodeGroup.empty()) {
    nodeGroup = svg.append("g").classed("nodes", true);
  }
  const node = nodeGroup
    .selectAll(".node")
    .data(data)
    .join("g")
    .classed("node", true)
    .attr("data-target", (d) => d.id);
  node
    .append("circle")
    .attr("r", (d) => nodeValueRadius(d.value, iconSize))
    .classed("fixed", (d) => d.fx !== undefined);
  node
    .append("svg:image")
    .attr("xlink:href", (d) => `assets/${d.image}`)
    .attr("x", iconSize / -2)
    .attr("y", iconSize / -2)
    .attr("width", iconSize)
    .attr("height", iconSize);
  const text = node
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", 0)
    .attr("y", -iconSize / 2)
    .text((d) => d.name);
  text.clone(true).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3);
  text.raise();

  const value = node
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", 0)
    .attr("y", iconSize / 2 + 8)
    .text((d) => d.value + " $");
  value.clone(true).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3);
  value.raise();

  return node;
}

function linkArc({ iconSize }: Config, d) {
  const arrowFix = 2;
  const R = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
  const r = nodeValueRadius(d.source.value, iconSize);
  const x = (r * (d.target.x - d.source.x)) / R + d.source.x;
  const y = (r * (d.target.y - d.source.y)) / R + d.source.y;

  const r1 = nodeValueRadius(d.target.value, iconSize) + arrowFix;
  const x1 = (r1 * (d.source.x - d.target.x)) / R + d.target.x;
  const y1 = (r1 * (d.source.y - d.target.y)) / R + d.target.y;

  if (isNaN(x) || isNaN(y)) {
    return "";
  }
  return `
    M${x},${y}
    A${R},${R} 0 0 0 ${x1},${y1}
  `;
}

function nodeValueRadius(value, iconSize) {
  const fixedVal = Number(value) || 1;
  return Math.log2(fixedVal) + iconSize / 2 + 2;
}