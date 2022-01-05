import React, { memo, PureComponent } from "react";
import { Layer, Group, Line, Rect, Text } from "react-konva";
import { Animation } from "konva";
import NodeRep from "./NodeRep";

// Visual encoding for focal nodes: black strokes
// Note that focalGroups is an array of array
export const FocusLayer = memo(({ focalGroups, nodes, coords, focalBBox, nodeSize, useStroke }) => (
    <Layer listening={false}>
        <Group>
            {!!focalBBox &&
                focalBBox.map((h, i) => (
                    <Group key={i}>
                        <Rect
                            x={h.x}
                            y={h.y - 14}
                            width={37}
                            height={14}
                            strokeEnabled={false}
                            opacity={0.8}
                            fill="rgb(231, 215, 164)"
                        />
                        <Text x={h.x + 2} y={h.y - 13} text={`foc-${i}`} fontSize={14} />
                        <Rect {...h} stroke="black" strokeWidth={1} fillEnabled={false} />
                    </Group>
                ))}
        </Group>
        {focalGroups.map((g, gIdx) => (
            <Group key={gIdx}>
                {g.map((nodeIdx, i) => (
                    <NodeRep
                        key={i}
                        x={coords[nodeIdx].x}
                        y={coords[nodeIdx].y}
                        radius={nodeSize}
                        typeId={nodes[nodeIdx].typeId}
                        style={{
                            fillEnabled: false,
                            stroke: useStroke ? useStroke : "#000",
                            strokeWidth: 1,
                            strokeEnabled: !!useStroke,
                        }}
                    />
                ))}
            </Group>
        ))}
    </Layer>
));

export class HighlightLayer extends PureComponent {
    render() {
        const {
            highlightedNodes,
            highlightedEdges,
            nodes,
            nodeColors,
            coords,
            nodeSize,
            edgeBundlePoints,
            showEdges,
            width,
            height,
        } = this.props;
        return (
            <Layer listening={false}>
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill="white"
                    opacity={0.7}
                    strokeEnabled={false}
                />
                <Group>
                    {showEdges &&
                        !!highlightedEdges &&
                        highlightedEdges.map(
                            (e, i) =>
                                coords[e.source] &&
                                coords[e.target] && (
                                    <Line
                                        key={i}
                                        points={
                                            edgeBundlePoints
                                                ? edgeBundlePoints[e.eid]
                                                : [
                                                      coords[e.source].x,
                                                      coords[e.source].y,
                                                      coords[e.target].x,
                                                      coords[e.target].y,
                                                  ]
                                        }
                                        stroke="black"
                                        strokeWidth={1}
                                        opacity={1}
                                        tension={edgeBundlePoints ? 0.5 : 0}
                                    />
                                )
                        )}
                </Group>
                <Group>
                    {highlightedNodes.map(
                        (nodeIdx, i) =>
                            coords[nodeIdx] && (
                                <NodeRep
                                    key={i}
                                    x={coords[nodeIdx].x}
                                    y={coords[nodeIdx].y}
                                    radius={nodeSize}
                                    typeId={nodes[nodeIdx].typeId}
                                    style={{ fill: nodeColors[nodeIdx], strokeEnabled: false }}
                                />
                            )
                    )}
                </Group>
            </Layer>
        );
    }
}

const animPeriod = (2 * Math.PI) / 1500;
export class HoverLayer extends PureComponent {
    // componentDidMount() {
    //     this.anim = new Animation((frame) => {
    //         this.layer.opacity((Math.sin(frame.time * animPeriod) + 1) / 2);
    //     }, this.layer);

    //     this.anim.start();
    // }
    // componentWillUnmount() {
    //     if (this.anim) {
    //         this.anim.stop();
    //     }
    // }
    render() {
        const {
            hoveredNodes,
            hoveredEdges,
            nodes,
            coords,
            nodeColors,
            nodeSize,
            edgeBundlePoints,
            showEdges,
            width,
            height,
        } = this.props;
        return (
            <Layer listening={false}>
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill="white"
                    opacity={0.7}
                    strokeEnabled={false}
                />
                <Group>
                    {showEdges &&
                        !!hoveredEdges &&
                        hoveredEdges.map(
                            (e, i) =>
                                coords[e.source] &&
                                coords[e.target] && (
                                    <Line
                                        key={i}
                                        points={
                                            edgeBundlePoints
                                                ? edgeBundlePoints[e.eid]
                                                : [
                                                      coords[e.source].x,
                                                      coords[e.source].y,
                                                      coords[e.target].x,
                                                      coords[e.target].y,
                                                  ]
                                        }
                                        stroke="black"
                                        tension={edgeBundlePoints ? 0.5 : 0}
                                        strokeWidth={1}
                                        opacity={1}
                                    />
                                )
                        )}
                </Group>
                <Group>
                    {hoveredNodes.map(
                        (nodeIdx, i) =>
                            coords[nodeIdx] && (
                                <NodeRep
                                    key={i}
                                    x={coords[nodeIdx].x}
                                    y={coords[nodeIdx].y}
                                    radius={nodeSize * 1.5}
                                    typeId={nodes[nodeIdx].typeId}
                                    style={{ fill: nodeColors[nodeIdx], stroke: "black", strokeWidth: 2 }}
                                />
                            )
                    )}
                </Group>
            </Layer>
        );
    }
}
