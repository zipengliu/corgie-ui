import React, { Component, useCallback } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { faBan } from "@fortawesome/free-solid-svg-icons";
import debounce from "lodash.debounce";
import { changeParam, highlightNodes, hoverNode } from "../actions";
import Histogram from "./Histogram";

function FeatureMatrix({ values, hovered, highlighted, scale, spec, hoverFunc, highlightFunc }) {
    const { margins, cellSize, cellGap, stripMaxWidth } = spec;

    const n = values.length;
    const size = cellSize + cellGap;
    // Make a square matrix instead of a long line
    const numCols = Math.floor(stripMaxWidth / size);
    const numRows = Math.ceil(n / numCols);

    const width = size * numCols + margins.left + margins.right,
        height = size * numRows + margins.top + margins.bottom;

    return (
        <svg width={width} height={height} className="feature-matrix">
            <g transform={`translate(${margins.left},${margins.top})`}>
                {values.map((v, i) => (
                    <rect
                        key={i}
                        className={cn("cell", {
                            hovered: hovered && hovered.hasOwnProperty(i) && hovered[i] !== 0,
                            highlighted: highlighted && highlighted.hasOwnProperty(i) && highlighted[i] !== 0,
                        })}
                        x={(i % numCols) * size}
                        y={Math.floor(i / numCols) * size}
                        width={cellSize}
                        height={cellSize}
                        fill={scale(v)}
                        onMouseEnter={hoverFunc.bind(null, [i])}
                        onMouseLeave={hoverFunc.bind(null, null)}
                        onClick={highlightFunc.bind(null, [i])}
                    >
                        <title>
                            feature index: {i} count: {v}
                        </title>
                    </rect>
                ))}
            </g>
        </svg>
    );
}

function FeatureStrips({
    compressedCnts,
    hovered,
    highlighted,
    colorScale,
    spec,
    stripMapping,
    hoverFunc,
    highlightFunc,
}) {
    const { stripHeight, margins, stripWidth } = spec;
    const width = compressedCnts.length * stripWidth + margins.left + margins.right;
    const height = stripHeight + margins.top + margins.bottom;

    return (
        <svg width={width} height={height} className="feature-strips">
            <g transform={`translate(${margins.left},${margins.top})`}>
                <g>
                    {compressedCnts.map((v, i) => (
                        <line
                            className={cn("strip", {
                                hovered: hovered && hovered.hasOwnProperty(i) && hovered[i] !== 0,
                                highlighted:
                                    highlighted && highlighted.hasOwnProperty(i) && highlighted[i] !== 0,
                            })}
                            key={i}
                            x1={i * stripWidth}
                            y1={0}
                            x2={i * stripWidth}
                            y2={stripHeight}
                            stroke={colorScale(v)}
                            style={{ strokeWidth: `${stripWidth}px` }}
                            onMouseEnter={hoverFunc.bind(null, stripMapping[i])}
                            onMouseLeave={hoverFunc.bind(null, null)}
                            onClick={highlightFunc.bind(null, stripMapping[i])}
                        >
                            <title>
                                feature index: [{stripMapping[i].toString()}], sum of counts: {v}
                            </title>
                        </line>
                    ))}
                </g>
                <rect
                    x={-2}
                    y={0}
                    width={compressedCnts.length * stripWidth + 2}
                    height={stripHeight}
                    style={{ strokeWidth: "1px", stroke: "grey", strokeDasharray: "5,5", fill: "None" }}
                />
            </g>
        </svg>
    );
}

function FeatureComboVis({
    displayId,
    data,
    stripMapping,
    hovered,
    highlighted,
    collapsed,
    toggleFunc,
    spec,
    legendText,
    hoverNode,
    highlightNodes,
}) {
    const { cnts, compressedCnts, scale, mode } = data;
    const e = scale.domain();
    const colorMin = scale(e[0]),
        colorMid = scale((e[0] + e[1]) / 2),
        colorMax = scale(e[1]);

    const debouncedHover = useCallback(
        debounce((featureIndices) => {
            if (featureIndices && featureIndices.length) {
                let nodes = [];
                for (let fid of featureIndices) {
                    if (data.featToNid.hasOwnProperty(fid)) {
                        nodes = nodes.concat(data.featToNid[fid]);
                    }
                }
                hoverNode(nodes, { cellIds: featureIndices, displayId });
            } else {
                hoverNode(null);
            }
        }, 300)
    );

    const highlightFunc = (featureIndices) => {
        let nodes = [];
        for (let fid of featureIndices) {
            if (data.featToNid.hasOwnProperty(fid)) {
                nodes = nodes.concat(data.featToNid[fid]);
            }
        }
        highlightNodes(nodes, null, "feature", { displayId: displayId, cellIds: featureIndices });
    };

    return (
        <div className="feature-combo">
            <div>
                <FeatureStrips
                    compressedCnts={compressedCnts}
                    stripMapping={stripMapping}
                    hovered={hovered && hovered.displayId === displayId ? hovered.compressedCnts : null}
                    highlighted={
                        highlighted && highlighted.displayId === displayId ? highlighted.compressedCnts : null
                    }
                    colorScale={scale}
                    spec={spec}
                    hoverFunc={debouncedHover}
                    highlightFunc={highlightFunc}
                />
            </div>
            {!collapsed && (
                <div>
                    <FeatureMatrix
                        values={cnts}
                        hovered={hovered && hovered.displayId === displayId ? hovered.cnts : null}
                        highlighted={
                            highlighted && highlighted.displayId === displayId ? highlighted.cnts : null
                        }
                        mode={mode}
                        scale={scale}
                        spec={spec}
                        hoverFunc={debouncedHover}
                        highlightFunc={highlightFunc}
                    />
                </div>
            )}
            <div style={{ marginLeft: "10px" }}>
                <span>
                    <Button variant="outline-secondary" size="xxs" onClick={toggleFunc}>
                        {collapsed ? "Show" : "Hide"} feature matrix
                    </Button>
                </span>
                <span style={{ marginLeft: "15px", marginRight: "10px" }}>strip / cell color: </span>
                <span style={{ marginRight: "3px" }}>{e[0]}</span>
                <div
                    style={{
                        display: "inline-block",
                        height: "10px",
                        width: "100px",
                        background: `linear-gradient(90deg, ${colorMin} 0%, ${colorMid} 50%, ${colorMax} 100%)`,
                    }}
                ></div>
                <span style={{ marginLeft: "3px" }}>{e[1]}</span>
                <span style={{ marginLeft: "10px" }}>{legendText}</span>
            </div>
        </div>
    );
}
const mapDispatchToPropsFeature = (dispatch) => bindActionCreators({ hoverNode, highlightNodes }, dispatch);
const FeatureComboVisConnected = connect(null, mapDispatchToPropsFeature)(FeatureComboVis);

class NodeAttrView extends Component {
    findBrushedNodesAndDispatch(whichType, whichRow, whichAttr, v1, v2) {
        const { nodes, selectedNodes } = this.props;
        let h;
        if (whichRow === 0) {
            // first row
            h = nodes
                .filter((n) => whichType === n.type && v1 <= n[whichAttr] && n[whichAttr] <= v2)
                .map((n) => n.id);
        } else {
            // foc-i row
            h = selectedNodes[whichRow - 1].filter(
                (id) =>
                    whichType === nodes[id].type && v1 <= nodes[id][whichAttr] && nodes[id][whichAttr] <= v2
            );
        }
        this.props.highlightNodes(h, [v1, v2], "node-attr", { attr: whichAttr, row: whichRow });
    }

    render() {
        const { param, nodeAttrs, featureAgg, hoveredNodes, changeParam } = this.props;
        const histSpec = this.props.spec.histogram,
            partialHistSpec = this.props.spec.partialHistogram;
        const { nodeFilter } = param;

        let hNodeData;
        if (!!hoveredNodes && hoveredNodes.length === 1) {
            hNodeData = this.props.nodes[hoveredNodes[0]];
        }

        let featureVisBlock;
        if (featureAgg.active) {
            featureVisBlock = featureAgg.display.map((d, i) => (
                <div className="stuff-container-hori" key={i}>
                    <div className="container-title">{d.title}</div>
                    <div className="container-body">
                        <FeatureComboVisConnected
                            displayId={i}
                            data={d}
                            stripMapping={featureAgg.stripMapping}
                            spec={this.props.spec.feature}
                            collapsed={param.features.collapsed[i]}
                            hovered={featureAgg.hovered}
                            highlighted={featureAgg.highlighted}
                            toggleFunc={changeParam.bind(this, "features.collapsed", null, true, i)}
                            legendText={d.title === "diff" ? "|counts of foc-0 - counts of foc-1|" : "#nodes"}
                        />
                    </div>
                </div>
            ));
        }

        let nodeAttrVisBlock;
        if (nodeAttrs.active) {
            nodeAttrVisBlock = nodeAttrs.display.map((d, k) => (
                <div key={k} className="stuff-container-hori">
                    <div className="container-title">{d.title}</div>
                    <div className="container-body">
                        {d.data.map((a, i) => (
                            <div key={i} className="histogram-block">
                                {k === 0 && <div className="histogram-title">{a.name}</div>}
                                {a.values.length === 0 ? (
                                    <div
                                        className="text-center"
                                        style={{
                                            width:
                                                histSpec.width +
                                                histSpec.margins.left +
                                                histSpec.margins.right,
                                        }}
                                    >
                                        {/* N/A */}
                                        <FontAwesomeIcon icon={faBan} />
                                    </div>
                                ) : (
                                    <Histogram
                                        bins={a.bins}
                                        spec={k ? partialHistSpec : histSpec}
                                        hVal={
                                            nodeAttrs.hovered &&
                                            nodeAttrs.hovered.displayId === k &&
                                            hNodeData &&
                                            hNodeData.type === a.nodeType
                                                ? hNodeData[a.name]
                                                : null
                                        }
                                        hovered={
                                            nodeAttrs.hovered && nodeAttrs.hovered.displayId === k
                                                ? nodeAttrs.hovered.data[i]
                                                : null
                                        }
                                        highlighted={
                                            nodeAttrs.highlighted &&
                                            !nodeAttrs.hovered &&
                                            nodeAttrs.highlighted.displayId === k
                                                ? nodeAttrs.highlighted.data[i]
                                                : null
                                        }
                                        brushedFunc={this.findBrushedNodesAndDispatch.bind(
                                            this,
                                            a.nodeType,
                                            k,
                                            a.name
                                        )}
                                        brushedRange={
                                            nodeFilter.whichRow === k && nodeFilter.whichAttr === a.name
                                                ? nodeFilter.brushedArea
                                                : null
                                        }
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ));
        }

        return (
            <div id="node-attr-view" className="view">
                <h5 className="view-title text-center">
                    Node Features (#={featureAgg.active ? featureAgg.numFeatures : nodeAttrs.numAttrs})
                    <span style={{ marginLeft: "5px", cursor: "pointer" }}>
                        <OverlayTrigger
                            placement="bottom"
                            overlay={
                                <Tooltip id="neighbor-latent-map-tooltip">
                                    <span>
                                        Each row shows feature distribution of all / a focal group of nodes.
                                    </span>
                                    {featureAgg.active && (
                                        <span style={{ marginLeft: "5px" }}>
                                            More saturated color indicates a bigger count of nodes for row
                                            foc-i, or a bigger difference for row diff.
                                        </span>
                                    )}
                                    {this.props.selectedNodes.length > 2 && (
                                        <div style={{ fontWeight: "bold" }}>
                                            Note: the diff will only show up when there are exactly 2 focal
                                            groups.
                                        </div>
                                    )}
                                </Tooltip>
                            }
                        >
                            <FontAwesomeIcon icon={faQuestionCircle} />
                        </OverlayTrigger>
                    </span>
                </h5>
                <div className="view-body">
                    {featureVisBlock}
                    {nodeAttrVisBlock}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    nodes: state.graph.nodes,
    param: state.param,
    nodeAttrs: state.nodeAttrs,
    featureAgg: state.featureAgg,
    hoveredNodes: state.hoveredNodes,
    selectedNodes: state.selectedNodes,
    spec: state.spec,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam, highlightNodes }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NodeAttrView);
