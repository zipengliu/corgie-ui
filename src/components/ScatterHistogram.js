import React, { memo } from "react";
import {
    scaleLinear,
    max,
    interpolateGreys,
    scaleSequential,
    scaleSequentialLog,
    scaleLog,
    format,
    leastIndex,
} from "d3";
import Brush from "./Brush";

function ScatterHistogram({
    hasHist,
    data,
    isTopoVsLatent,
    spec,
    xLabel,
    yLabel,
    hVals,
    brushedFunc,
    brushedArea,
    useLinearScale,
}) {
    const { margins, histWidth, scatterWidth, legendWidth, histHeight, scatterHeight, tickLabelGap } = spec;
    const u = spec.gridBinSize,
        numBins = spec.numBins;
    const { binsLatent, binsTopo, binsFeature, gridsTopo, gridsFeature, src, tgt } = data;
    const gridBins = isTopoVsLatent ? gridsTopo.bins : gridsFeature.bins,
        gridBinsMaxCnt = isTopoVsLatent ? gridsTopo.maxCnt : gridsFeature.maxCnt,
        binsY = isTopoVsLatent ? binsTopo : binsFeature;
    let hValsY;
    if (hVals) {
        hValsY = isTopoVsLatent ? hVals[1] : hVals[2];
    }

    const svgWidth =
            margins.left +
            margins.right +
            (hasHist ? histWidth : 0) +
            scatterWidth +
            tickLabelGap +
            legendWidth,
        svgHeight = margins.top + margins.bottom + (hasHist ? histHeight : 0) + scatterHeight + tickLabelGap;

    // scales
    const uLat = u * scatterWidth,
        uTopo = u * scatterHeight;
    let colorScale,
        linearColorScale = scaleSequential(interpolateGreys).domain([0, gridBinsMaxCnt]);
    if (useLinearScale) {
        colorScale = linearColorScale;
    } else {
        const getColorLogScale = (domainMax) => {
            const s = scaleSequentialLog(interpolateGreys).domain([1, domainMax + 1]);
            return (x) => s(x + 1);
        };
        colorScale = getColorLogScale(gridBinsMaxCnt);
    }
    let histScales, maxCntLatent, maxCntY;

    if (hasHist) {
        maxCntLatent = max(binsLatent.map((b) => b.length));
        maxCntY = max(binsY.map((b) => b.length));
        if (useLinearScale) {
            histScales = {
                latent: scaleLinear().domain([0, maxCntLatent]).range([0, histHeight]),
                y: scaleLinear().domain([0, maxCntY]).range([0, histWidth]),
            };
        } else {
            const getLogScale = (domainMax, rangeMax) => {
                const s = scaleLog()
                    .domain([1, domainMax + 1])
                    .range([0, rangeMax]);
                return (x) => s(x + 1);
            };
            histScales = {
                latent: getLogScale(maxCntLatent, histHeight),
                y: getLogScale(maxCntY, histWidth),
            };
        }
    }
    const valFormat = format(".2f"),
        cntFormat = format(".2~s");

    const callSnapBrush = (a) => {
        function constrain(x) {
            return Math.max(0, Math.min(x, numBins - 1));
        }
        const x1 = constrain(Math.round(a.x / uLat)),
            y1 = constrain(Math.round((scatterHeight - a.y) / uTopo)),
            x2 = constrain(Math.round((a.x + a.width) / uLat)),
            y2 = constrain(Math.round((scatterHeight - a.y - a.height) / uTopo));
        let brushedPairIdx = [];
        for (let i = x1; i <= x2; i++) {
            for (let j = y2; j <= y1; j++) {
                brushedPairIdx = brushedPairIdx.concat(gridBins[i][j]);
            }
        }
        const brushedPairs = brushedPairIdx.map((p) => [src[p], tgt[p]]);
        brushedFunc(
            {
                x: x1 * uLat,
                y: scatterHeight - (y1 + 1) * uTopo,
                width: (x2 - x1 + 1) * uLat,
                height: (y1 - y2 + 1) * uTopo,
            },
            brushedPairs
        );
    };

    const arrowLen = 8; // extra length on the axis to make arrow head
    const histTickNum = 3,
        colorTickNum = 5;
    return (
        <svg width={svgWidth} height={svgHeight} className="histogram scatterplot">
            <g transform={`translate(${margins.left},${margins.top})`}>
                {/* legends */}
                <g
                    className="legend"
                    transform={`translate(${
                        (hasHist ? histWidth : 0) + tickLabelGap + scatterWidth + 10
                    }, 0)`}
                >
                    <text x={uLat / 2} y={10} textAnchor="middle">
                        0
                    </text>
                    <g transform="translate(0, 12)">
                        <rect
                            x={0}
                            y={0}
                            width={uTopo}
                            height={uLat * colorTickNum}
                            style={{ stroke: "black", fill: "none" }}
                        />
                        {new Array(colorTickNum).fill(0).map((_, i) => (
                            <rect
                                key={i}
                                x={0}
                                y={uTopo * i}
                                height={uLat}
                                width={uTopo}
                                fill={linearColorScale((i * gridBinsMaxCnt) / 5)}
                            />
                        ))}
                    </g>
                    <text x={9} y={12 + 3 * uTopo} textAnchor="start">
                        {cntFormat(
                            useLinearScale
                                ? gridBinsMaxCnt / 2
                                : Math.pow(10, Math.log10(gridBinsMaxCnt + 1) / 2)
                        )}
                    </text>
                    <text x={uLat / 2} y={24 + 5 * uTopo} textAnchor="middle">
                        {cntFormat(gridBinsMaxCnt)}
                    </text>
                </g>

                <g transform={`translate(${hasHist ? histWidth + tickLabelGap : tickLabelGap},0)`}>
                    {/* scatterplot points */}
                    <g>
                        {/* {dist.map((d, i) => (
                            <circle
                                key={i}
                                className="point"
                                cx={scatterScales.latent(d[0])}
                                cy={scatterHeight - scatterScales.topo(d[1])}
                                r={2}
                                opacity={0.5}
                            />
                        ))} */}
                        {gridBins.map((row, i) => (
                            <g key={i}>
                                {row.map((col, j) => (
                                    <rect
                                        key={j}
                                        x={i * uLat}
                                        y={scatterHeight - (j + 1) * uTopo}
                                        width={uLat}
                                        height={uTopo}
                                        fill={colorScale(col.length)}
                                        stroke="none"
                                    >
                                        <title>
                                            {xLabel}: {valFormat(i * u)} - {valFormat((i + 1) * u)}, {yLabel}:{" "}
                                            {valFormat(j * u)} -{valFormat((j + 1) * u)}. Count: {col.length}.
                                        </title>
                                    </rect>
                                ))}
                            </g>
                        ))}
                    </g>
                    {/* scatterplot x-axis */}
                    <g className="axis" transform={`translate(0,${scatterHeight})`}>
                        <line
                            x1={-3}
                            y1={2}
                            x2={scatterWidth + arrowLen}
                            y2={2}
                            markerEnd="url(#axis-arrow-head)"
                        />
                        {[".5", "1"].map((x, i) => (
                            <text key={i} x={scatterWidth * x} y={11} textAnchor="middle">
                                {x}
                            </text>
                        ))}
                        <text x={-10} y={11}>
                            0
                        </text>
                        {xLabel && (
                            <text x={scatterWidth + arrowLen} y={-5} textAnchor="end">
                                {xLabel}
                            </text>
                        )}
                    </g>
                    {/* scatterplot y-axis */}
                    <g className="axis">
                        <line
                            x1={-2}
                            y1={scatterHeight + 2}
                            x2={-2}
                            y2={-arrowLen}
                            markerEnd="url(#axis-arrow-head)"
                        />
                        {[".5", "1"].map((y, i) => (
                            <text key={i} x={-4} y={scatterHeight * (1 - y) + 3} textAnchor="end">
                                {y}
                            </text>
                        ))}
                        {yLabel && (
                            <text x={5} y={-5}>
                                {yLabel}
                            </text>
                        )}
                    </g>
                    {brushedFunc && (
                        <Brush
                            width={scatterWidth}
                            height={scatterHeight}
                            brushedFunc={callSnapBrush}
                            brushedArea={brushedArea}
                        />
                    )}
                    {hVals && (
                        <g className="value-marker">
                            {hValsY && (
                                <g transform={`translate(0,${(1 - hValsY) * scatterHeight - 1})`}>
                                    <line x1={0} y1={0} x2={scatterWidth} y2={0} />
                                    <rect x={scatterWidth} y={-8} width={34} height={16} />
                                    <text x={scatterHeight + 2} y={4}>
                                        {valFormat(hValsY)}
                                    </text>
                                </g>
                            )}
                            <g transform={`translate(${hVals[0] * scatterWidth},0)`}>
                                <line x1={0} y1={0} x2={0} y2={scatterHeight} />
                                <rect x={-20} y={-12} width={40} height={16} />
                                <text x={0} y={1} textAnchor="middle">
                                    {valFormat(hVals[0])}
                                </text>
                            </g>
                        </g>
                    )}
                </g>

                {hasHist && (
                    <g>
                        {/* latent histogram */}
                        <g
                            transform={`translate(${histWidth + tickLabelGap},${
                                scatterHeight + tickLabelGap
                            })`}
                        >
                            <g className="axis">
                                <line
                                    x1={-3}
                                    y1={0}
                                    x2={scatterWidth + arrowLen}
                                    y2={0}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                <line
                                    x1={-2}
                                    y1={0}
                                    x2={-2}
                                    y2={histHeight + arrowLen}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                {new Array(histTickNum).fill(0).map((_, i) => (
                                    <line
                                        key={i}
                                        x1={-2}
                                        y1={histScales.latent((maxCntLatent / histTickNum) * (i + 1))}
                                        x2={-6}
                                        y2={histScales.latent((maxCntLatent / histTickNum) * (i + 1))}
                                    />
                                ))}
                                <text x={-7} y={histHeight + 3} textAnchor="end">
                                    {cntFormat(maxCntLatent)}
                                </text>
                            </g>
                            <g>
                                {binsLatent.map((b, i) => (
                                    <rect
                                        className="bar"
                                        key={i}
                                        x={b.x0 * scatterWidth}
                                        y={0}
                                        width={uLat - 1}
                                        height={histScales.latent(b.length)}
                                    >
                                        <title>
                                            {xLabel}: {valFormat(b.x0)}-{valFormat(b.x1)} count: {b.length}
                                        </title>
                                    </rect>
                                ))}
                            </g>
                        </g>

                        {/* topo histogram */}
                        <g transform={`translate(${histWidth}, ${scatterHeight})`}>
                            <g className="axis">
                                <line
                                    x1={1}
                                    y1={2}
                                    x2={-histWidth - arrowLen}
                                    y2={2}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                <line
                                    x1={0}
                                    y1={3}
                                    x2={0}
                                    y2={-scatterHeight - arrowLen}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                {new Array(histTickNum).fill(0).map((_, i) => (
                                    <line
                                        key={i}
                                        x1={-histScales.y((maxCntY / histTickNum) * (i + 1))}
                                        y1={2}
                                        x2={-histScales.y((maxCntY / histTickNum) * (i + 1))}
                                        y2={6}
                                    />
                                ))}
                                <text x={-histWidth} y={17} textAnchor="middle">
                                    {cntFormat(maxCntY)}
                                </text>
                            </g>
                            <g>
                                {binsY.map((b, i) => (
                                    <rect
                                        className="bar"
                                        key={i}
                                        x={-histScales.y(b.length)}
                                        y={-b.x1 * scatterHeight}
                                        width={histScales.y(b.length)}
                                        height={uTopo - 1}
                                    >
                                        <title>
                                            {yLabel}: {valFormat(b.x0)}-{valFormat(b.x1)} count: {b.length}
                                        </title>
                                    </rect>
                                ))}
                            </g>
                        </g>
                    </g>
                )}
            </g>
        </svg>
    );
}

export default memo(ScatterHistogram);
