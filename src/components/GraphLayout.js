import React, { Component, useCallback, memo } from "react";
import { connect, ReactReduxContext, Provider } from "react-redux";
import { bindActionCreators } from "redux";
import { Stage, Layer, Group, Rect, Line, Text } from "react-konva";
import debounce from "lodash.debounce";
import NodeRep from "./NodeRep";
import { FocusLayer, HighlightLayer, HoverLayer } from "./NodeLayers";
import { highlightNodes, hoverNode, selectNodePair } from "../actions";
import { isPointInBox, isNodeBrushable, getNodeEmbeddingColor } from "../utils";

const initState = {
    mouseDown: false,
    startPoint: null, // page x and y of starting point
    endPoint: null,
    brushedArea: null, // Coordinates for the brushed area
};

class GraphLayout extends Component {
    constructor(props) {
        super(props);
        this.stageRef = React.createRef();
        this.state = initState;
    }

    // Dup code as in Embeddings2D.js.  TODO: reuse instead dup.
    callHighlightNodes(brushedArea) {
        const { nodes, highlightNodeType, highlightNodeLabel } = this.props;
        const { qt } = this.props.layoutData;
        const candidates = qt.retrieve(brushedArea);
        const targetNodes = [];
        for (let c of candidates) {
            if (
                isNodeBrushable(nodes[c.id], highlightNodeType, highlightNodeLabel) &&
                isPointInBox({ x: c.x + 0.5, y: c.y + 0.5 }, brushedArea)
            ) {
                targetNodes.push(c.id);
            }
        }
        console.log({ candidates, targetNodes, brushedArea });
        // if (targetNodes.length == 0) return;

        this.props.highlightNodes(targetNodes, brushedArea, this.props.fromView, null);
    }
    _onMouseDown() {
        const mousePos = this.stageRef.current.getPointerPosition();
        let nextState = {
            mouseDown: true,
            startPoint: mousePos,
            endPoint: mousePos,
            brushedArea: { x: mousePos.x, y: mousePos.y, width: 0, height: 0 },
        };
        this.setState(nextState);

        this.stageRef.current.on("mousemove", () => {
            const curPos = this.stageRef.current.getPointerPosition();
            this.setState({
                endPoint: curPos,
                brushedArea: this._getBrushedArea(curPos),
            });
        });
        this.stageRef.current.on("mouseup", () => {
            this.stageRef.current.off("mousemove");
            this.stageRef.current.off("mouseup");
            const b = { ...this.state.brushedArea };
            this.setState(initState);
            this.callHighlightNodes(b);
        });
    }
    _getBrushedArea(curPos) {
        const p1 = this.state.startPoint,
            p2 = curPos;
        const minX = Math.min(p1.x, p2.x),
            minY = Math.min(p1.y, p2.y),
            maxX = Math.max(p1.x, p2.x),
            maxY = Math.max(p1.y, p2.y);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    render() {
        const {
            layoutData,
            nodes,
            nodeColors,
            selectedNodes,
            highlightedNodes,
            highlightedEdges,
            hoveredNodesAndNeighbors,
            hoveredEdges,
            fromView,
            colorBy,
            showEdges,
            useEdgeBundling,
        } = this.props;
        const { width, height, coords, groups, qt, focalBBox } = layoutData;
        const canvasW = width + 2,
            canvasH = height + 2;
        const ebp = showEdges === "bundled" && useEdgeBundling ? layoutData.edgeBundlePoints : null;
        const baseNodeColors = fromView === "emb" && colorBy === "umap" ? "black" : nodeColors;

        let { nodeSize } = this.props;
        if (fromView === "emb") {
            nodeSize--;
        }

        return (
            <ReactReduxContext.Consumer>
                {({ store }) => (
                    <Stage
                        width={canvasW}
                        height={canvasH}
                        ref={this.stageRef}
                        onMouseDown={!!qt ? this._onMouseDown.bind(this) : () => {}}
                    >
                        <Provider store={store}>
                            {fromView === "emb" && colorBy === "umap" && <ColorTiles w={width} />}
                            <BaseLayer
                                coords={coords}
                                groups={groups}
                                nodeSize={nodeSize}
                                edgeBundlePoints={ebp}
                                nodeColors={baseNodeColors}
                                fromView={fromView}
                                showEdges={showEdges}
                            />

                            {selectedNodes.length > 0 && (
                                <FocusLayer
                                    focalGroups={selectedNodes}
                                    focalBBox={focalBBox}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={baseNodeColors}
                                    nodeSize={nodeSize}
                                    useStroke={
                                        this.props.useStrokeForFocal
                                            ? fromView === "emb"
                                                ? "#aaa"
                                                : "#000"
                                            : false
                                    }
                                    showEdges={showEdges}
                                />
                            )}
                            {highlightedNodes.length > 0 && (
                                <HighlightLayer
                                    highlightedNodes={highlightedNodes}
                                    highlightedEdges={highlightedEdges}
                                    coords={coords}
                                    edgeBundlePoints={ebp}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                    width={canvasW}
                                    height={canvasH}
                                    showEdges={showEdges}
                                />
                            )}
                            {hoveredNodesAndNeighbors.length > 0 && (
                                <HoverLayer
                                    hoveredNodes={hoveredNodesAndNeighbors}
                                    hoveredEdges={hoveredEdges}
                                    coords={coords}
                                    nodes={nodes}
                                    edgeBundlePoints={ebp}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                    width={canvasW}
                                    height={canvasH}
                                    showEdges={showEdges}
                                />
                            )}
                            {this.state.brushedArea && (
                                <Layer>
                                    <Rect
                                        {...this.state.brushedArea}
                                        fill="blue"
                                        opacity={0.3}
                                        stroke="grey"
                                        strokeWidth={1}
                                    />
                                </Layer>
                            )}
                        </Provider>
                    </Stage>
                )}
            </ReactReduxContext.Consumer>
        );
    }
}
const mapStateToProps = (state) => ({
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    nodeSize: state.param.nodeSize,
    useEdgeBundling: state.param.focalGraph.useEdgeBundling,
    nodeColors: state.nodeColors,
    colorBy: state.param.colorBy,
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
    highlightedEdges: state.highlightedEdges,
    hoveredNodesAndNeighbors: state.hoveredNodesAndNeighbors,
    hoveredEdges: state.hoveredEdges,
    highlightNodeType: state.param.highlightNodeType,
    highlightNodeLabel: state.param.highlightNodeLabel,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            hoverNode,
            selectNodePair,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GraphLayout);

function BaseLayerUnconnected({
    nodes,
    edges,
    coords,
    edgeBundlePoints,
    showEdges,
    nodeColors,
    groups,
    hoverNode,
    highlightNodes,
    nodeSize,
    fromView,
}) {
    console.log("BaseLayer render()", fromView);
    const debouncedHover = useCallback(debounce((x) => hoverNode(x), 300));

    return (
        <Layer>
            {showEdges && (
                <Group>
                    {edges.map(
                        (e, i) =>
                            coords[e.source] &&
                            coords[e.target] && (
                                <Line
                                    key={i}
                                    points={
                                        edgeBundlePoints
                                            ? edgeBundlePoints[i]
                                            : [
                                                  coords[e.source].x,
                                                  coords[e.source].y,
                                                  coords[e.target].x,
                                                  coords[e.target].y,
                                              ]
                                    }
                                    stroke="#aaa"
                                    strokeWidth={1}
                                    hitStrokeWidth={2}
                                    opacity={edgeBundlePoints ? 0.3 : 0.3}
                                    tension={edgeBundlePoints ? 0.5 : 0}
                                    onMouseOver={debouncedHover.bind(null, [e.source, e.target])}
                                    onMouseOut={debouncedHover.bind(null, null)}
                                    onClick={highlightNodes.bind(
                                        null,
                                        [e.source, e.target],
                                        null,
                                        "graph-edge",
                                        null
                                    )}
                                />
                            )
                    )}
                </Group>
            )}
            <Group>
                {coords.map(
                    (c, i) =>
                        c && (
                            <NodeRep
                                key={i}
                                x={c.x}
                                y={c.y}
                                radius={nodeSize}
                                typeId={nodes[i].typeId}
                                style={{
                                    // fill: nodeColors.length ? nodeColors[i] : nodeColors,
                                    fill: Array.isArray(nodeColors) ? nodeColors[i] : nodeColors,
                                    opacity: 1,
                                    strokeEnabled: false,
                                }}
                                events={{
                                    onMouseOver: debouncedHover.bind(null, i),
                                    onMouseOut: debouncedHover.bind(null, null),
                                    onClick: highlightNodes.bind(null, [i], null, fromView, null),
                                }}
                            />
                        )
                )}
            </Group>
            {groups && (
                <Group>
                    {groups.map((g, i) => (
                        <Group key={i}>
                            <Rect
                                x={g.bounds.x}
                                y={g.bounds.y - 16}
                                width={70 + Math.floor(Math.log10(g.num)) * 6}
                                height={16}
                                opacity={0.8}
                                fill="rgb(231, 215, 164)"
                                stroke="rgb(231, 215, 164)"
                                strokeWidth={1}
                            />
                            <Rect
                                x={g.bounds.x}
                                y={g.bounds.y}
                                width={g.bounds.width}
                                height={g.bounds.height}
                                // stroke="black"
                                // stroke="#af7c0d"
                                stroke="rgb(231, 215, 164)"
                                strokeWidth={2}
                                // dash={[2, 2]}
                                fillEnabled={false}
                            />
                            <Text
                                text={`${g.name} (#=${g.num})`}
                                x={g.bounds.x + 4}
                                y={g.bounds.y - 14}
                                fontSize={12}
                            />
                        </Group>
                    ))}
                </Group>
            )}
        </Layer>
    );
}

const mapStateToPropsBaseLayer = (state) => ({
    nodes: state.graph.nodes,
    edges: state.graph.edges,
});

const BaseLayer = connect(mapStateToPropsBaseLayer, mapDispatchToProps)(BaseLayerUnconnected);

const ColorTiles = memo(({ w }) => {
    const unitSize = 5,
        num = w / unitSize;
    const tileArr = new Array(num).fill(0);
    return (
        <Layer listening={false}>
            {tileArr.map((_, i) => (
                <Group key={i}>
                    {tileArr.map((_, j) => (
                        <Rect
                            key={j}
                            x={i * unitSize}
                            y={j * unitSize}
                            width={unitSize}
                            height={unitSize}
                            fill={getNodeEmbeddingColor(i / num, j / num)}
                            strokeEnabled={false}
                        />
                    ))}
                </Group>
            ))}
        </Layer>
    );
});
