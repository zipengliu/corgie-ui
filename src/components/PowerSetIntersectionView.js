import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { scaleLinear, max } from "d3";

class PowerSetIntersectionView extends Component {
    render() {
        const { graph, neighborIntersections, selectedNodes, selectedCountsByType } = this.props;
        if (neighborIntersections === null) return <div />;
        const { nodes, nodeTypes } = graph;

        // Compute height and width of SVG
        const spec = this.props.spec.intersectionPlot;
        const {
            margins,
            dotSize,
            dotMargin,
            verticalMargin,
            cardScaleRange,
            plotHorizontalMargin,
            topLabelHeight
        } = spec;
        const n = selectedNodes.length,
            numberOfTypes = neighborIntersections.length;
        const dotsWidth = n * (dotSize + dotMargin);
        const svgWidth =
                margins.left +
                margins.right +
                dotsWidth +
                numberOfTypes * (cardScaleRange + plotHorizontalMargin),
            svgHeight =
                margins.top +
                margins.bottom +
                topLabelHeight +
                neighborIntersections[0].length * (verticalMargin + dotSize);

        // Compute the scale for bar charts
        // TODO: consider using another max value for the domain since the overlap of neighbors might be small and the bars are really tiny
        // const scalesByType = selectedCountsByType.map(c => scaleLinear().domain([0, c+1]).range([0, cardScaleRange]));
        const scalesByType = neighborIntersections.map(inter =>
            scaleLinear()
                .domain([0, max(inter, x => x.size) + 1])
                .range([0, cardScaleRange])
        );

        return (
            <div id="semantic-space-view" className="view">
                <h5>PowerSet intersections of neighbor sets of selected nodes</h5>
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        <g className="combinations">
                            <g className="labels"></g>
                            <g transform={`translate(${dotMargin / 2},${topLabelHeight})`}>
                                {neighborIntersections[0].map((row, i) => (
                                    <g
                                        key={i}
                                        transform={`translate(${dotSize / 2},${i *
                                            (dotSize + verticalMargin) +
                                            dotSize / 2})`}
                                    >
                                        {selectedNodes.map((_, j) => (
                                            <circle
                                                key={j}
                                                className={cn("dot", { selected: row.combo.get(j) })}
                                                cx={j * (dotSize + dotMargin)}
                                                cy={0}
                                                r={dotSize / 2}
                                            />
                                        ))}
                                    </g>
                                ))}
                            </g>
                        </g>

                        <g className="bar-charts" transform={`translate(${dotsWidth},0)`}>
                            {neighborIntersections.map((plotData, i) => (
                                <g
                                    key={i}
                                    transform={`translate(${i * (cardScaleRange + plotHorizontalMargin)},0)`}
                                >
                                    <g className="axis">
                                        <text
                                            x={0}
                                            y={topLabelHeight - 4}
                                            transform={`rotate(-15,0,${topLabelHeight - 4})`}
                                        >
                                            {nodeTypes[i].name}
                                        </text>
                                        <line
                                            x1={0}
                                            y1={topLabelHeight - 2}
                                            x2={cardScaleRange + 2}
                                            y2={topLabelHeight - 2}
                                            markerEnd="url(#arrow)"
                                        />
                                    </g>
                                    <g transform={`translate(0,${topLabelHeight})`}>
                                        {plotData.map((row, j) => (
                                            <g
                                                key={j}
                                                transform={`translate(0,${j * (dotSize + verticalMargin)})`}
                                            >
                                                <rect
                                                    className="bar"
                                                    x={0}
                                                    y={0}
                                                    height={dotSize}
                                                    width={scalesByType[i](row.size)}
                                                    style={{ fill: nodeTypes[i].color }}
                                                />
                                                {row.size > 0 && (
                                                    <text x={scalesByType[i](row.size) + 2} y={8}>
                                                        {row.size}
                                                    </text>
                                                )}
                                            </g>
                                        ))}
                                    </g>
                                </g>
                            ))}
                        </g>
                    </g>

                    <defs>
                        <marker
                            id="arrow"
                            markerWidth="10"
                            markerHeight="10"
                            refX="0"
                            refY="3"
                            orient="auto"
                            markerUnits="strokeWidth"
                        >
                            <path d="M0,0 L0,6 L9,3 z" fill="#000" />
                        </marker>
                    </defs>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = state => ({ ...state });

const mapDispatchToProps = dispatch => bindActionCreators({}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(PowerSetIntersectionView);
