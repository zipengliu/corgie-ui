import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { scaleSequential, interpolateGreens, interpolateReds } from "d3";
import { highlightNodes, highlightNeighbors } from "../actions";
import NodeRep from "./NodeRep";
import RollupMatrix from "./RollupMatrix";
import { getNeighborDistance } from "../layouts";

class AdjacencyMatrix extends Component {
    render() {
        const {
            graph,
            selectedNodes,
            isNodeHighlighted,
            isNodeSelected,
            isNodeSelectedNeighbor,
            neighGrp,
            neighMap,
            neighArr,
        } = this.props;
        const { nodes, neighborMasks } = graph;
        const { neighborDistanceMetric } = this.props.param;
        const spec = this.props.spec.adjacencyMatrix;
        const { margins, rowHeight, colWidth, gap, labelAreaSize, labelSize } = spec;
        const { centralNodeSize, auxNodeSize } = this.props.spec.graph;
        const numNeighbors = neighArr[0].length;
        const fullSvgWidth = numNeighbors * (colWidth + gap) + labelAreaSize + margins.left + margins.right,
            fullSvgHeight =
                labelAreaSize +
                selectedNodes.length * (rowHeight + gap) +
                // 50 +
                // numNeighbors * (rowHeight + gap) +
                margins.top +
                margins.bottom;

        const distColorScale = scaleSequential(interpolateGreens).domain(
            neighborDistanceMetric === "hamming" ? [selectedNodes.length, 0] : [1, 0]
        );
        const colorLegendTicks =
            neighborDistanceMetric === "hamming"
                ? selectedNodes.map((_, i) => i)
                : [0, 0.2, 0.4, 0.6, 0.8, 1.0];

        const highlightStrips = Object.keys(isNodeHighlighted).filter((neighId) =>
            neighMap.hasOwnProperty(neighId)
        );

        if (selectedNodes.length > 500) {
            return <div />;
        }

        return (
            <div id="adjacency-matrix-view" className="view">
                <h5>Adjacency matrix of selected nodes</h5>

                <RollupMatrix />

                <p>Fully expanded matrix for selected nodes and 1-hop neighbors</p>
                <svg width={fullSvgWidth} height={fullSvgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        {/*row labels*/}
                        <g
                            className="labels"
                            transform={`translate(${labelAreaSize - labelSize / 2 - 4},${
                                labelAreaSize + labelSize / 2
                            })`}
                        >
                            {selectedNodes.map((id, i) => (
                                <g
                                    key={i}
                                    transform={`translate(0,${i * (rowHeight + gap)})`}
                                    className={cn("node", {
                                        highlighted: isNodeHighlighted[id],
                                        selected: isNodeSelected[id],
                                        "hop-1": isNodeSelectedNeighbor[id] === 1,
                                        "hop-2": isNodeSelectedNeighbor[id] === 2,
                                    })}
                                    onMouseEnter={this.props.highlightNodes.bind(null, id)}
                                    onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                >
                                    <NodeRep
                                        shape={nodes[id].typeId === 0 ? "triangle" : "circle"}
                                        r={nodes[id].typeId === 0 ? centralNodeSize : auxNodeSize}
                                    />
                                    <text
                                        x={-labelSize}
                                        y={0}
                                        textAnchor="end"
                                        transform={`rotate(30,${-labelSize},${0})`}
                                    >
                                        {nodes[id].label}
                                    </text>
                                </g>
                            ))}
                        </g>

                        {/*columns */}
                        <g
                            className="labels"
                            transform={`translate(${labelAreaSize + labelSize / 2},${
                                labelAreaSize - labelSize / 2 - 4
                            })`}
                        >
                            {/* highlight strips */}
                            {highlightStrips.map((neighId, i) => (
                                <g key={i}>
                                    <rect
                                        className="highlight-strip"
                                        x={-20}
                                        y={
                                            (selectedNodes.length + neighMap[neighId].order) *
                                                (rowHeight + gap) +
                                            20 -
                                            2
                                        }
                                        width={numNeighbors * (colWidth + gap) + 40}
                                        height={rowHeight + 4}
                                    />
                                    <rect
                                        className="highlight-strip"
                                        x={neighMap[neighId].order * (colWidth + gap) - 2}
                                        y={-20}
                                        width={rowHeight + 4}
                                        height={(selectedNodes.length + numNeighbors) * (colWidth + gap) + 40}
                                    />
                                </g>
                            ))}
                            {/* visual encoding for grouping */}
                            {neighGrp[0].map((grp, grpIdx) => (
                                <g
                                    key={grpIdx}
                                    transform={`translate(${grp.prevTotal * (colWidth + gap)},0)`}
                                >
                                    <g transform={`translate(0,0)`}>
                                        <line
                                            className="group-line"
                                            x1={0}
                                            y1={-50}
                                            x2={grp.nodes.length * (colWidth + gap) - gap}
                                            y2={-50}
                                            onMouseEnter={this.props.highlightNeighbors.bind(null, grp.nodes)}
                                            onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                        />

                                        {grp.subgroups.map((subgrp, subgrpIdx) => (
                                            <line
                                                key={subgrpIdx}
                                                className="subgroup-line"
                                                x1={grp.subGroupPrevTotal[subgrpIdx] * (colWidth + gap)}
                                                y1={-30}
                                                x2={
                                                    (grp.subGroupPrevTotal[subgrpIdx] + subgrp.length) *
                                                        (colWidth + gap) -
                                                    gap
                                                }
                                                y2={-30}
                                                onMouseEnter={this.props.highlightNeighbors.bind(
                                                    null,
                                                    subgrp
                                                )}
                                                onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                            />
                                        ))}
                                    </g>
                                </g>
                            ))}

                            {neighArr[0].map((neighId, i) => (
                                <g key={i} transform={`translate(${i * (colWidth + gap)},0)`}>
                                    {/* column labels */}
                                    <g
                                        transform={`translate(${colWidth / 2},0)`}
                                        className={cn("node", {
                                            highlighted: isNodeHighlighted[neighId],
                                            selected: isNodeSelected[neighId],
                                            "hop-1": isNodeSelectedNeighbor[neighId] === 1,
                                            "hop-2": isNodeSelectedNeighbor[neighId] === 2,
                                        })}
                                        onMouseEnter={this.props.highlightNodes.bind(null, neighId)}
                                        onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                    >
                                        <NodeRep
                                            shape={nodes[neighId].typeId === 0 ? "triangle" : "circle"}
                                            r={nodes[neighId].typeId === 0 ? centralNodeSize : auxNodeSize}
                                        />
                                        <text x={2} y={-labelSize} transform={`rotate(-30,2,${-labelSize})`}>
                                            {nodes[neighId].label}
                                            {/* (node idx: {neighId}) */}
                                        </text>
                                        {/* {grp.isBoundary[neighId] && (
                                                    <line
                                                        x1={-(colWidth + gap) / 2}
                                                        y1={-30 - (i === 0 ? 50 : 0)}
                                                        x2={-(colWidth + gap) / 2}
                                                        y2={
                                                            labelSize / 2 +
                                                            selectedNodes.length * (rowHeight + gap) +
                                                            (i === 0 ? 50 : 20)
                                                        }
                                                        style={{ stroke: i === 0 ? "black" : "grey" }}
                                                    />
                                                )} */}
                                    </g>

                                    {/* cells for adjacency matrix */}
                                    <g transform={`translate(0,${labelSize / 2})`}>
                                        {selectedNodes.map((selectedId, j) => (
                                            <rect
                                                key={j}
                                                className="cell"
                                                x={0}
                                                y={j * (rowHeight + gap)}
                                                width={colWidth}
                                                height={rowHeight}
                                                style={{
                                                    fill: neighborMasks[selectedId].get(neighId)
                                                        ? "#000"
                                                        : "#ccc",
                                                }}
                                                onMouseEnter={this.props.highlightNeighbors.bind(null, [
                                                    neighId,
                                                ])}
                                                onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                            />
                                        ))}
                                    </g>

                                    {/* cells of distance matrix */}
                                    {/* <g
                                        transform={`translate(0,${
                                            selectedNodes.length * (rowHeight + gap) + 20
                                        })`}
                                    >
                                        {neighArr[0].map((neighId2, i2) => (
                                            <rect
                                                key={i2}
                                                className="cell"
                                                x={0}
                                                y={i2 * (rowHeight + gap)}
                                                width={colWidth}
                                                height={rowHeight}
                                                style={{
                                                    fill: distColorScale(
                                                        getNeighborDistance(
                                                            neighMap[neighId].mask,
                                                            neighMap[neighId2].mask,
                                                            neighborDistanceMetric
                                                        )
                                                    ),
                                                }}
                                                onMouseEnter={this.props.highlightNeighbors.bind(null, [
                                                    neighId,
                                                    neighId2,
                                                ])}
                                                onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                            />
                                        ))}
                                    </g> */}
                                </g>
                            ))}
                        </g>

                        {/* legends */}
                        {/* <g>
                            <text x={0} y={labelAreaSize + selectedNodes.length * (rowHeight + gap) + 10}>
                                {neighborDistanceMetric} distances:
                            </text>
                        </g>

                        <g
                            transform={`translate(${labelAreaSize},${
                                (selectedNodes.length + numNeighbors) * (rowHeight + gap) + 40 + labelAreaSize
                            })`}
                        >
                            <text x={-labelAreaSize}>Distance legends:</text>
                            {colorLegendTicks.map((val, i) => (
                                <g key={i} transform={`translate(${i * (colWidth + gap)},0)`}>
                                    <rect
                                        x={0}
                                        y={0}
                                        width={colWidth}
                                        height={rowHeight}
                                        style={{ fill: distColorScale(val) }}
                                    />
                                    <text x={2} y={10}>
                                        {val}
                                    </text>
                                </g>
                            ))}
                        </g> */}
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            highlightNeighbors,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(AdjacencyMatrix);
