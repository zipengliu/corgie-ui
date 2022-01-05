import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { scaleLinear, scaleSequential, interpolateBlues } from 'd3';
import cn from 'classnames';
import { highlightNodes, highlightNeighbors } from "../actions";
import NodeRep from "./NodeRep";

export class RollupMatrix extends Component {
    render() {
        const {
            graph,
            selectedNodes,
            isNodeHighlighted,
            isNodeSelected,
            isNodeSelectedNeighbor,
            neighGrp,
        } = this.props;
        const { nodes } = graph;
        const spec = this.props.spec.adjacencyMatrix;
        const {
            margins,
            rowHeight,
            colWidth,
            gap,
            histogramAreaHeight,
            histogramHeight,
            labelHeight,
            labelAreaSize,
            labelSize,
        } = spec;
        const { centralNodeSize, auxNodeSize } = this.props.spec.graph;
        const rollUpSvgWidth =
                neighGrp[0].length * (colWidth + gap) * 2 + labelAreaSize + margins.left + margins.right,
            rollUpSvgHeight =
                selectedNodes.length * (rowHeight + gap) +
                labelAreaSize +
                histogramAreaHeight +
                margins.top +
                margins.bottom;

        // Find the max number in the count matrix
        let maxCount = 1,
            maxNeighGrp = 1;
        for (let grp of neighGrp[0]) {
            for (let selectedId of selectedNodes) {
                maxCount = Math.max(grp.cntsPerSelected[selectedId], maxCount);
            }
            maxNeighGrp = Math.max(grp.nodes.length, maxNeighGrp);
        }
        const colorScale = scaleSequential(interpolateBlues).domain([0, maxCount]);

        // The y-scale for the historgram on top of the roll-up matrix
        const numNeighScale = scaleLinear().domain([0, maxNeighGrp]).range([0, histogramHeight]);
        return (
            <div>
                <p>
                    Roll-up matrix for selected nodes and 1-hop neighbors. Neighbors are grouped and sorted by
                    #selected nodes they connect to.
                </p>
                <svg width={rollUpSvgWidth} height={rollUpSvgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        {/*row labels*/}
                        <g
                            className="labels"
                            transform={`translate(${labelAreaSize - 10},${histogramAreaHeight + gap + 10})`}
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
                                        transform={`rotate(-30,${-labelSize},${0})`}
                                    >
                                        {nodes[id].label}
                                    </text>
                                </g>
                            ))}
                        </g>

                        {/* columns */}
                        <g className="labels" transform={`translate(${labelAreaSize + gap},0)`}>
                            {neighGrp[0].map((grp, grpIdx) => (
                                <g
                                    key={grpIdx}
                                    transform={`translate(${
                                        2 * grpIdx * (colWidth + gap)
                                    },${histogramAreaHeight})`}
                                >
                                    <g
                                        onMouseEnter={this.props.highlightNeighbors.bind(null, grp.nodes)}
                                        onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                    >
                                        <rect
                                            x={0}
                                            y={-labelHeight - numNeighScale(grp.nodes.length)}
                                            width={colWidth}
                                            height={numNeighScale(grp.nodes.length)}
                                            style={{ fill: "grey" }}
                                        />
                                        <text x={0} y={-labelHeight - numNeighScale(grp.nodes.length) - 2}>
                                            {grp.nodes.length}
                                        </text>
                                        <text x={0} y={0}>
                                            {grp.freq}
                                        </text>
                                    </g>

                                    {/* cells */}
                                    <g transform={`translate(0,${gap})`}>
                                        {selectedNodes.map((selectedId, i) => (
                                            <g
                                                key={i}
                                                transform={`translate(0,${i * (rowHeight + gap)})`}
                                                onMouseEnter={this.props.highlightNeighbors.bind(
                                                    null,
                                                    grp.nodesPerSelected[selectedId]
                                                )}
                                                onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                            >
                                                <rect
                                                    x={0}
                                                    y={0}
                                                    width={colWidth}
                                                    height={rowHeight}
                                                    style={{
                                                        fill: colorScale(grp.cntsPerSelected[selectedId]),
                                                    }}
                                                />
                                                <text
                                                    y={10}
                                                    style={{
                                                        fill:
                                                            grp.cntsPerSelected[selectedId] < maxCount / 2
                                                                ? "black"
                                                                : "white",
                                                    }}
                                                >
                                                    {grp.cntsPerSelected[selectedId]}
                                                </text>
                                            </g>
                                        ))}
                                    </g>
                                </g>
                            ))}
                        </g>
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            highlightNeighbors,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(RollupMatrix);
