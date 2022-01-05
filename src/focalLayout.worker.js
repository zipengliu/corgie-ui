import * as Comlink from "comlink";
import {
    extent,
    forceSimulation,
    forceManyBody,
    forceLink,
    forceX,
    forceY,
    scaleSqrt,
    scaleLinear,
} from "d3";
import { Layout as cola } from "webcola";
import bs from "bitset";
import { sampleSize, flatten, range as lodashRange } from "lodash";
import { getNeighborDistance, computeEdgeDict } from "./utils";
// import forceBundling from "./forceBundling";
// import kernelBundling from "./kernelBundling";
import mingleBundling from "./mingleBundling";

const maxNumNodes = 10000;
let state = {
    numNodes: null,
    edges: null,
    edgeDict: null,
    distMetric: null,
    hops: 0,
    neighborMasks: null,
    neighborMasks1hop: null,
    getCanvasSize: scaleSqrt().domain([1, maxNumNodes]).range([350, 1000]).clamp(true),
    spec: null,
};

function initializeState(numNodes, edges, neighborMasks, neighborMasks1hop, hops, distMetric, spec) {
    state.numNodes = numNodes;
    state.edges = edges;
    state.edgeDict = computeEdgeDict(numNodes, edges);
    state.neighborMasks = neighborMasks.map((m) => bs(m));
    state.neighborMasks1hop = neighborMasks1hop.map((m) => bs(m));
    state.hops = hops;
    state.distMetric = distMetric;
    state.spec = spec;
}

function getDistance2D(u, v) {
    return Math.sqrt(Math.pow(u.x - v.x, 2) + Math.pow(u.y - v.y, 2));
}

const getMaxSampleNodes = (numGroups) => Math.floor(200 / numGroups);
function computeEnergyBetweenHop(coords, curHop, nextHop, maxSampleNodes = 100) {
    let energy = 0;
    const { edgeDict } = state;

    let h1 = curHop,
        h2 = nextHop;
    if (curHop.length > maxSampleNodes * 1.2) {
        h1 = sampleSize(curHop, maxSampleNodes);
    }
    if (nextHop.length > maxSampleNodes * 1.2) {
        h2 = sampleSize(nextHop, maxSampleNodes);
    }

    for (let prevHopNode of h1) {
        for (let nextHopNode of h2) {
            const d = getDistance2D(coords[prevHopNode], coords[nextHopNode]);
            energy += -Math.log(d);
            if (edgeDict[prevHopNode].hasOwnProperty(nextHopNode)) {
                energy += d;
            }
        }
    }
    return energy;
}

// Evaluate the readability of a layout.
// Return the node-repulsion LinLog energy (only consider edges and node pairs between groups)
function evaluateLayout(coords, nodesByHop) {
    let energy = 0;
    for (let i = 0; i < nodesByHop.length - 1; i++) {
        energy += computeEnergyBetweenHop(coords, nodesByHop[i], nodesByHop[i + 1]);
    }
    return energy;
}

function computeGroupPositions(selectedNodes, nodesByHop) {
    const numFoc = selectedNodes.length;
    const { hops } = state;
    const { padding, gapBetweenHop, gapBetweenFocal, paddingTop, paddingBottom } = state.spec;

    // Get the number of nodes for each hop
    const nums = nodesByHop.map((n) => n.length);
    const numNodes = nums.reduce((prev, cur) => prev + cur, 0);

    // Allocate space for each hop
    let canvasHeight = state.getCanvasSize(numNodes);
    const canvasWidth = canvasHeight * 1.3;
    canvasHeight += paddingTop + paddingBottom;
    // Resize the embeddings for the four different groups of nodes: selected, 1-hop, 2-hop, 3-hop,...
    const weights = [10, 10];
    console.assert(hops <= 5);
    for (let i = 2; i <= hops; i++) {
        weights.push(weights[weights.length - 1] - 2);
    }
    const weightedSum = nums.reduce((prev, cur, i) => prev + Math.log2(cur + 1) * weights[i], 0);
    const usableWidth = canvasWidth - hops * gapBetweenHop;
    const groupWidths = nums.map((ni, i) => ((weights[i] * Math.log2(ni + 1)) / weightedSum) * usableWidth);
    const availHeightsFocal =
        canvasHeight - (numFoc - 1) * gapBetweenFocal - numFoc * 2 * padding - paddingTop - paddingBottom;
    const groupHeights = [
        selectedNodes.map((s) =>
            Math.min(groupWidths[0], (availHeightsFocal / nums[0]) * s.length + 2 * padding)
        ),
    ];
    let maxNeighHeight = 0;
    for (let i = 1; i <= hops; i++) {
        const h = Math.min(canvasHeight, groupWidths[i]);
        groupHeights.push(h);
        maxNeighHeight = Math.max(maxNeighHeight, h);
    }
    // Re-visit the canvasHeight since the heights might not used up.
    const focalHeightSum = groupHeights[0].reduce((prev, cur) => prev + cur, 0);
    let possibleFocalHeight = focalHeightSum + gapBetweenFocal * (numFoc - 1);
    canvasHeight = Math.min(
        canvasHeight,
        Math.max(possibleFocalHeight, maxNeighHeight) + paddingBottom + paddingTop
    );
    console.log({ canvasWidth, canvasHeight, groupWidths, groupHeights });

    let groups = [];
    let xOffset = 0,
        yOffset = paddingTop,
        actualGapFocal = 0;
    // position the focal groups
    if (numFoc > 1) {
        // The vertical gap between focal groups is not gapBetweenHop
        actualGapFocal = (canvasHeight - paddingTop - focalHeightSum) / (numFoc - 1);
    } else {
        yOffset = (canvasHeight - groupHeights[0][0]) / 2;
    }
    for (let j = 0; j < numFoc; j++) {
        const w = Math.min(groupHeights[0][j], groupWidths[0]);
        const bbox = {
            x: xOffset + (groupWidths[0] - w) / 2,
            y: yOffset,
            width: w,
            height: groupHeights[0][j],
        };
        groups.push({ bounds: bbox, name: `foc-${j}`, num: selectedNodes[j].length });
        yOffset += bbox.height + actualGapFocal;
    }
    xOffset += groupWidths[0] + gapBetweenHop;
    for (let i = 1; i <= hops; i++) {
        const bbox = {
            x: xOffset,
            y: Math.max((canvasHeight - groupHeights[i]) / 2, paddingTop),
            width: groupWidths[i],
            height: groupHeights[i],
        };
        groups.push({ bounds: bbox, name: `hop-${i}`, num: nodesByHop[i].length });
        xOffset += groupWidths[i] + gapBetweenHop;
    }
    return { groups, numNodes, canvasWidth, canvasHeight };
}

function getSubGraphMapping(selectedNodes, neighArr) {
    // Remap the node id since we don't want the outside nodes in the focal layout
    // mapping from original ID to new ID;
    const nodeMapping = {},
        reverseMapping = {};
    let k = 0;
    for (let s of selectedNodes) {
        for (let nid of s) {
            nodeMapping[nid] = k;
            reverseMapping[k] = nid;
            k++;
        }
    }
    for (let h = 0; h < neighArr.length; h++) {
        for (let nid of neighArr[h]) {
            nodeMapping[nid] = k;
            reverseMapping[k] = nid;
            k++;
        }
    }
    const remappedEdges = state.edges
        .filter((e) => nodeMapping.hasOwnProperty(e.source) && nodeMapping.hasOwnProperty(e.target))
        .map((e) => ({
            source: nodeMapping[e.source],
            target: nodeMapping[e.target],
            i: e.eid,
        }));
    return { nodeMapping, reverseMapping, remappedEdges };
}

function computeFocalLayoutWithUMAP(selectedNodes, neighArr, embeddings, useEdgeBundling) {
    const startTime = new Date();
    console.log("Computing k-hop focal layout...");

    const n = state.numNodes,
        numFoc = selectedNodes.length;
    const { hops, edges } = state;
    const { padding, gapBetweenHop } = state.spec;

    const nodesByHop = [flatten(selectedNodes), ...neighArr];

    // Compute embeddings for each hop
    // let embeddings = [[]];
    // for (let s of selectedNodes) {
    //     embeddings[0].push(runUMAP(s, state.neighborMasks));
    //     nodesByHop[0] = nodesByHop[0].concat(s);
    // }
    // for (let i = 1; i <= hops; i++) {
    //     embeddings.push(
    //         runUMAP(neighArr[i - 1], useGlobalMask ? state.neighborMasks : state.neighborMasks1hop)
    //     );
    //     nodesByHop.push(neighArr[i - 1]);
    // }
    // Use random for the others as they are not important at the moment
    // embeddings.push(others.map(() => [Math.random(), Math.random()]));
    // console.log({ embeddings });

    // Rescale the UMAP embeddings to a width x height rectangular space
    let rescale = (nodes, emb, width, height, xOffset, yOffset, padding) => {
        if (nodes.length === 1) {
            // Only one node, place it in the middle
            coords[nodes[0]] = { x: xOffset + width / 2, y: yOffset + height / 2 };
        } else {
            const xExtent = extent(emb.map((e) => e[0])),
                yExtent = extent(emb.map((e) => e[1]));
            const xScale = scaleLinear()
                    .domain(xExtent)
                    .range([xOffset + padding, xOffset + width - padding]),
                yScale = scaleLinear()
                    .domain(yExtent)
                    .range([yOffset + padding, yOffset + height - padding]);
            for (let i = 0; i < nodes.length; i++) {
                coords[nodes[i]] = {
                    x: xScale(emb[i][0]),
                    y: yScale(emb[i][1]),
                };
            }
        }
    };

    function flipGroup(nodes, oldCoords, newCoords, isHorizontal, bbox) {
        const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        for (let nid of nodes) {
            if (isHorizontal) {
                newCoords[nid] = {
                    x: -(oldCoords[nid].x - center.x) + center.x,
                    y: oldCoords[nid].y,
                };
            } else {
                newCoords[nid] = {
                    x: oldCoords[nid].x,
                    y: -(oldCoords[nid].y - center.y) + center.y,
                };
            }
        }
    }

    // rotate one group within a bbox.  Results are recorded in newCoords in place.
    function rotateGroup(nodes, oldCoords, newCoords, degree, bbox) {
        if (nodes.length === 1) {
            // No change
            newCoords[nodes[0]] = { ...oldCoords[nodes[0]] };
            return;
        }
        const r = (degree / 180) * Math.PI;
        const transMatrix = [
            [Math.cos(r), -Math.sin(r)],
            [Math.sin(r), Math.cos(r)],
        ];
        const tempCoords = [];
        const centerX = bbox.x + bbox.width / 2,
            centerY = bbox.y + bbox.height / 2;
        for (let nid of nodes) {
            const c = oldCoords[nid];
            // Change in place
            tempCoords.push({
                x: transMatrix[0][0] * (c.x - centerX) + transMatrix[0][1] * (c.y - centerY) + centerX,
                y: transMatrix[1][0] * (c.x - centerX) + transMatrix[1][1] * (c.y - centerY) + centerY,
            });
        }

        if ([0, 90, 180, 270].indexOf(degree) === -1) {
            // rescale since nodes might go out of bbox
            const xExtent = extent(tempCoords.map((t) => t.x)),
                yExtent = extent(tempCoords.map((t) => t.y));
            const xScale = scaleLinear()
                    .domain(xExtent)
                    .range([bbox.x + padding, bbox.x + bbox.width - padding]),
                yScale = scaleLinear()
                    .domain(yExtent)
                    .range([bbox.y + padding, bbox.y + bbox.height - padding]);
            for (let i = 0; i < nodes.length; i++) {
                newCoords[nodes[i]] = {
                    x: xScale(tempCoords[i].x),
                    y: yScale(tempCoords[i].y),
                };
            }
        } else {
            for (let i = 0; i < nodes.length; i++) {
                newCoords[nodes[i]] = {
                    x: tempCoords[i].x,
                    y: tempCoords[i].y,
                };
            }
        }
        // console.log({ degree, nodes, newCoords });
    }

    const { groups, numNodes, canvasWidth, canvasHeight } = computeGroupPositions(selectedNodes, nodesByHop);
    const coords = new Array(n);
    for (let j = 0; j < numFoc; j++) {
        const bbox = groups[j].bounds;
        rescale(selectedNodes[j], embeddings[0][j], bbox.width, bbox.height, bbox.x, bbox.y, padding);
    }
    for (let i = 1; i <= hops; i++) {
        const bbox = groups[i + numFoc - 1].bounds;
        rescale(neighArr[i - 1], embeddings[i], bbox.width, bbox.height, bbox.x, bbox.y, padding);
    }

    // Find the best rotation
    const rotDegrees = [0, 90, 180, 270];
    let bestCoords = coords,
        bestEnergy = Number.MAX_SAFE_INTEGER,
        bestTrans = null;
    const newCoords = coords.map((c) => ({ ...c }));
    const trans = [];
    let numTrans = 0;
    const ss = getMaxSampleNodes(groups.length);
    console.log("max sample size = ", ss);
    function getDeltaE(groupIdx) {
        if (groupIdx >= numFoc) {
            return computeEnergyBetweenHop(
                newCoords,
                nodesByHop[groupIdx - numFoc],
                nodesByHop[groupIdx - numFoc + 1],
                ss
            );
        } else {
            return 0;
        }
    }
    // enumerate transformation of each group
    function dfs(groupIdx, curEnergy) {
        let deltaE = 0;
        if (groupIdx == groups.length) {
            numTrans++;
            // console.log(`Transformation settings #${numTrans}: ${curEnergy} `, trans.slice());
            // const e = evaluateLayout(newCoords, nodesByHop);
            if (curEnergy < bestEnergy) {
                bestEnergy = curEnergy;
                bestCoords = newCoords.map((c) => ({ ...c }));
                bestTrans = trans.slice();
            }
            return;
        }
        const groupNodes = groupIdx < numFoc ? selectedNodes[groupIdx] : nodesByHop[groupIdx - numFoc + 1];
        if (groupNodes.length > 1) {
            const bbox = groups[groupIdx].bounds;
            for (let d of rotDegrees) {
                if (d > 0) {
                    rotateGroup(groupNodes, coords, newCoords, d, bbox);
                }
                trans.push(`rotate ${d}`);
                deltaE = getDeltaE(groupIdx);
                dfs(groupIdx + 1, curEnergy + deltaE);
                trans.pop();
            }
            flipGroup(groupNodes, coords, newCoords, true, bbox);
            trans.push("flip horizontally");
            deltaE = getDeltaE(groupIdx);
            dfs(groupIdx + 1, curEnergy + deltaE);
            trans.pop();

            flipGroup(groupNodes, coords, newCoords, false, bbox);
            trans.push("flip vertically");
            deltaE = getDeltaE(groupIdx);
            dfs(groupIdx + 1, curEnergy + deltaE);
            trans.pop();
        } else {
            if (groupNodes.length === 1) {
                newCoords[groupNodes[0]] = coords[groupNodes[0]];
            }
            deltaE = getDeltaE(groupIdx);
            dfs(groupIdx + 1, curEnergy + deltaE);
        }
    }
    const adjStartTime = new Date();
    dfs(0, 0);
    const adjEndTime = new Date();
    const adjSecTaken = (adjEndTime.getTime() - adjStartTime.getTime()) / 1000;
    console.log(`Time for adjustment: ${adjSecTaken}s`);

    // Perform edge bundling
    let remappedBundleRes = null;
    const remainingEdges = [];
    for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if (bestCoords[e.source] && bestCoords[e.target]) {
            remainingEdges.push({ source: e.source, target: e.target, i });
        }
    }
    // // Test if dup edge
    // let hdup = {};
    // for (let e of remainingEdges) {
    //     if (!hdup.hasOwnProperty(e.source)) {
    //         hdup[e.source] = {};
    //     }
    //     if (hdup[e.source].hasOwnProperty(e.target)) {
    //         console.error('Dup edge: ', e.source, e.target);
    //     }
    //     hdup[e.source][e.target] = 0;
    // }
    if (useEdgeBundling) {
        remappedBundleRes = performEdgeBundling(remainingEdges, bestCoords);
    }

    console.log({ numTrans, bestEnergy, bestTrans });

    const endTime = new Date();
    const secTaken = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`Total time for coordinate optimization: ${secTaken}s`);

    return {
        name: "grouped UMAP",
        coords: bestCoords,
        edgeBundlePoints: remappedBundleRes,
        remainingEdges,
        groups,
        width: canvasWidth,
        height: canvasHeight,
        numNodes,
        numEdges: remainingEdges.length,
    };
}

function performEdgeBundling(edges, coords) {
    console.log("Edge bundling....");
    const startTime = new Date();

    let remappedBundleRes = {};
    // Force-based edge bundling
    // const fbdl = forceBundling()
    //     .nodes(coords)
    //     .edges(edges)
    //     .subdivision_rate(1.05)
    //     .iterations(10)
    //     .iterations_rate(0.5)
    //     .cycles(2);
    // .cycles(6)
    // .step_size(0.1)
    // .compatibility_threshold(0.6);

    // Kernel density estimation edge bundling
    // const fbdl = kernelBundling().nodes(bestCoords).edges(remainingEdges);
    // const bundleRes = fbdl();

    // remapp the edge bundle results using the edge id
    // remappedBundleRes = {};
    // for (let i = 0; i < remainingEdges.length; i++) {
    //     let flattenCoords = [];
    //     for (let c of bundleRes[i]) {
    //         flattenCoords.push(c.x);
    //         flattenCoords.push(c.y);
    //     }
    //     remappedBundleRes[remainingEdges[i].i] = flattenCoords;
    // }

    // MINGLE bundling
    const delta = 0.8;
    const bundle = new mingleBundling({
        curviness: 1,
        angleStrength: 1,
    });
    const edgeData = edges.map((e) => ({
        id: e.i,
        name: e.i,
        data: {
            coords: [coords[e.source].x, coords[e.source].y, coords[e.target].x, coords[e.target].y],
        },
    }));
    bundle.setNodes(edgeData);
    bundle.buildNearestNeighborGraph(10);
    bundle.MINGLE();
    remappedBundleRes = {};

    bundle.graph.each(function (node) {
        const edges = node.unbundleEdges(delta);
        for (let e of edges) {
            // if (Math.random() > 0.9) {
            //     console.log(e);
            // }
            const originalEdgeId = e[0].node.id;
            const flattenCoords = [];
            for (let point of e) {
                flattenCoords.push(point.unbundledPos[0]);
                flattenCoords.push(point.unbundledPos[1]);
            }
            remappedBundleRes[originalEdgeId] = flattenCoords;
        }
    });
    // console.log(remappedBundleRes);
    const endTime = new Date();
    console.log("Edge bundling takes ", (endTime.getTime() - startTime.getTime()) / 1000, "s");

    return remappedBundleRes;
}

function computeFocalLayoutWithCola(selectedNodes, neighArr, useGlobalMask, nodeSize) {
    const startTime = new Date();
    console.log("Computing local layout with WebCola...", new Date());

    const { spec, distMetric, hops } = state;
    const { padding, gapBetweenHop } = spec;
    const numFoc = selectedNodes.length;

    const { nodeMapping, reverseMapping, remappedEdges } = getSubGraphMapping(selectedNodes, neighArr);

    // Construct group info for webcola
    const coords = [],
        groups = [],
        diameter = nodeSize * 2;
    for (let j = 0; j < numFoc; j++) {
        groups.push({
            id: j,
            leaves: selectedNodes[j].map((nid) => nodeMapping[nid]),
            padding: spec.padding,
            name: `foc-${j}`,
        });
        for (let nid of selectedNodes[j]) {
            coords.push({ index: nodeMapping[nid], width: diameter, height: diameter, group: j, padding });
        }
    }
    for (let h = 0; h < hops; h++) {
        groups.push({
            id: h + numFoc,
            leaves: neighArr[h].map((nid) => nodeMapping[nid]),
            padding: padding * 2,
            name: `hop-${h + 1}`,
        });
        for (let nid of neighArr[h]) {
            coords.push({
                index: nodeMapping[nid],
                width: diameter,
                height: diameter,
                group: h + numFoc,
                padding: 5,
            });
        }
    }
    // console.log("cola coords: ", coords);
    // console.log("cola groups: ", groups);

    const numNodes = Object.keys(nodeMapping).length;
    const canvasSize = state.getCanvasSize(numNodes);

    const constraints = [];
    for (let j = 0; j < numFoc - 1; j++) {
        for (let n1 of groups[j].leaves) {
            for (let n2 of groups[j + 1].leaves) {
                constraints.push({
                    axis: "y",
                    left: n1,
                    right: n2,
                    gap: gapBetweenHop + padding * 4,
                });
            }
        }
    }
    for (let j = 0; j < numFoc; j++) {
        for (let focNode of groups[j].leaves) {
            for (let hop1Node of groups[numFoc].leaves) {
                constraints.push({
                    axis: "x",
                    left: focNode,
                    right: hop1Node,
                    gap: gapBetweenHop + padding * 2,
                });
            }
        }
    }
    for (let h = 1; h <= hops - 1; h++) {
        for (let curHopNode of groups[numFoc + h - 1].leaves) {
            for (let nextHopNode of groups[numFoc + h].leaves) {
                constraints.push({
                    axis: "x",
                    left: curHopNode,
                    right: nextHopNode,
                    gap: gapBetweenHop + 2 * padding,
                });
            }
        }
    }
    console.log("#constrainst = ", constraints.length);

    // for (let grp of neighGrp[0]) {
    //     for (let nodeA of grp.nodes) {
    //         // 1-hop neighbors are below selected nodes
    //         for (let nodeB of groups[0].leaves) {
    //             constraints.push({ axis: "y", left: nodeB, right: nodeA, gap: 40 });
    //         }
    //         // 1-hop neighbors are above 2-hop neighbors and others
    //         for (let nodeB of groups[2].leaves) {
    //             constraints.push({ axis: "y", left: nodeA, right: nodeB, gap: 40 });
    //         }
    //     }
    // }
    // // 2-hop neighbors are above others
    // for (let nodeA of groups[2].leaves) {
    //     for (let nodeB of groups[3].leaves) {
    //         constraints.push({ axis: "y", left: nodeA, right: nodeB, gap: 40 });
    //     }
    // }
    // // Order the groups in 1-hop neighbors from left to right
    // for (let i = 0; i < neighGrp[0].length - 1; i++) {
    //     for (let nodeA of neighGrp[0][i].nodes) {
    //         for (let nodeB of neighGrp[0][i + 1].nodes) {
    //             constraints.push({ axis: "x", left: nodeA, right: nodeB, gap: 25 });
    //         }
    //     }
    // }
    // console.log("layout constraints: ", constraints);

    const masks = useGlobalMask ? state.neighborMasks : state.neighborMasks1hop;
    function getDist(x, y) {
        const orix = reverseMapping[x],
            oriy = reverseMapping[y];
        const maskx = masks[orix],
            masky = masks[oriy];
        if (maskx && masky) {
            return getNeighborDistance(maskx, masky, distMetric);
        } else {
            return 1;
        }
    }

    let simulation = new cola()
        .size([canvasSize, canvasSize])
        .nodes(coords)
        .links(remappedEdges)
        .groups(groups)
        .defaultNodeSize(nodeSize * 2)
        .constraints(constraints)
        // .linkDistance(15)
        .linkDistance((e) => 100 * getDist(e.source, e.target))
        // .symmetricDiffLinkLengths(2, 1)
        // .jaccardLinkLengths(50, 1)
        .avoidOverlaps(true)
        // .convergenceThreshold(1e-2)
        // .start(10);
        .start(10, 15, 20);

    // let iter = 0;
    // while (!simulation.tick()) {
    //     iter++;
    // }
    // console.log({iter});

    // for (let i = 0; i < 0; i++) {
    //     simulation.tick();
    // }
    // console.log(coords);

    // simulation.constraints([]);

    // Bound the y coords within canvas
    for (let g of groups) {
        const e = extent(coords.map((c) => c.y));
        if ((e[0] > 0) & (e[1] < canvasSize)) {
            continue;
        }
        const scaleY = scaleLinear()
            .domain(e)
            .range([padding + 2, canvasSize - padding - 2]);
        for (let c of coords) {
            c.y = scaleY(c.y);
        }
    }
    // Map node id back to the original id system
    const allCoords = new Array(numNodes);
    for (let originalId in nodeMapping) {
        if (nodeMapping.hasOwnProperty(originalId)) {
            const c = coords[nodeMapping[originalId]];
            allCoords[originalId] = { x: c.x, y: c.y };
        }
    }
    console.log({ allCoords, groups });

    // if (!groups[0].bounds) {
    for (let g of groups) {
        let xMin = 1e9,
            xMax = 0,
            yMin = 1e9,
            yMax = 0;
        for (let c of g.leaves) {
            xMin = Math.min(xMin, c.x);
            xMax = Math.max(xMax, c.x);
            yMin = Math.min(yMin, c.y);
            yMax = Math.max(yMax, c.y);
        }
        g.bbox = {
            x: xMin - padding,
            y: yMin - padding,
            width: xMax - xMin + 2 * padding,
            height: yMax - yMin + 2 * padding,
        };
    }
    // }

    const endTime = new Date();
    const secTaken = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`Total time: ${secTaken}s`);
    return {
        name: "WebCola",
        coords: allCoords,
        groups: groups.map((g) => ({
            id: g.id,
            bounds: g.bbox || {
                x: g.bounds.x,
                y: g.bounds.y,
                width: g.bounds.width(),
                height: g.bounds.height(),
            },
            name: g.name,
            num: g.leaves.length,
        })),
        width: canvasSize,
        height: canvasSize,
        numNodes: coords.length,
        numEdges: remappedEdges.length,
        // simulation,
        // simulationTickNumber: 10,
    };
}

function computeFocalLayoutWithD3(selectedNodes, neighArr, useGlobalMask) {
    const masks = useGlobalMask ? state.neighborMasks : state.neighborMasks1hop;
    const { distMetric } = state;
    const { nodeMapping, reverseMapping, remappedEdges } = getSubGraphMapping(selectedNodes, neighArr);

    const nodesByHop = [flatten(selectedNodes), ...neighArr];
    const { numNodes, groups, canvasWidth, canvasHeight } = computeGroupPositions(selectedNodes, nodesByHop);
    console.log({ canvasWidth, canvasHeight, groups });
    for (let g of groups) {
        const bbox = g.bounds;
        g.center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    }
    let remappedCoords = lodashRange(numNodes).map((i) => ({ index: i }));
    for (let i = 0; i < selectedNodes.length; i++) {
        const nodes = selectedNodes[i];
        for (let n of nodes) {
            remappedCoords[nodeMapping[n]].group = i;
        }
    }
    for (let i = 1; i < nodesByHop.length; i++) {
        const nodes = nodesByHop[i];
        for (let n of nodes) {
            remappedCoords[nodeMapping[n]].group = i + selectedNodes.length - 1;
        }
    }

    // Construct virtual links for group of neighbor nodes
    const groupLinks = [];
    for (let id1 in nodeMapping)
        if (nodeMapping.hasOwnProperty(id1)) {
            for (let id2 in nodeMapping)
                if (id1 !== id2 && nodeMapping.hasOwnProperty(id2)) {
                    groupLinks.push({
                        source: nodeMapping[id1],
                        target: nodeMapping[id2],
                        dist: getNeighborDistance(masks[id1], masks[id2], distMetric),
                    });
                }
        }
    // console.log(groupLinks);

    let simulation = forceSimulation(remappedCoords)
        // .force("link", forceLink(remappedEdges))
        .force(
            "neighborDistance",
            forceLink(groupLinks)
                .distance((d) => d.dist * 200)
                .strength(10 / numNodes)
        )
        .force("charge", forceManyBody().strength(-1000))
        // .force("centerX", forceX(canvasWidth / 2).strength(0.2))
        // .force("centerY", forceY(canvasHeight / 2).strength(0.2))
        .force(
            "groupX",
            forceX()
                .x((d) => groups[d.group].center.x)
                .strength(1)
        )
        .force(
            "groupY",
            forceY()
                .y((d) => groups[d.group].center.y)
                .strength(1)
        )
        .stop();

    const bounded = true;
    const numIterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    const { padding } = state.spec;
    if (bounded) {
        for (let i = 0; i < numIterations; i++) {
            // Constrain the nodes in a bounding box
            for (let c of remappedCoords) {
                const bbox = groups[c.group].bounds;
                c.x = bbox.x + Math.max(padding, Math.min(bbox.width - padding, c.x - bbox.x));
                c.y = bbox.y + Math.max(padding, Math.min(bbox.height - padding, c.y - bbox.y));
            }
            simulation.tick();
        }
    } else {
        simulation.tick(numIterations);
    }

    const coords = new Array(state.numNodes);
    for (let i = 0; i < remappedCoords.length; i++) {
        coords[reverseMapping[i]] = remappedCoords[i];
    }

    return {
        name: "D3 force-directed",
        coords,
        groups: bounded ? groups : null,
        width: canvasWidth,
        height: canvasHeight,
        // remainingEdges,
        numNodes,
        numEdges: remappedEdges.length,
    };
}

function computeSpaceFillingCurveLayout(selectedNodes, neighArr, useGlobalMask) {
    const masks = useGlobalMask ? state.neighborMasks : state.neighborMasks1hop;
    const { nodeMapping, reverseMapping, remappedEdges } = getSubGraphMapping(selectedNodes, neighArr);
    const { distMetric } = state;
    const { padding, gapBetweenHop } = state.spec;

    const nodesByHop = [flatten(selectedNodes), ...neighArr];
    const orderedNodes = flatten(nodesByHop);
    const numNodes = orderedNodes.length;
    const isStartOfGroup = {};
    let count = 0;
    for (let i = 1; i < selectedNodes.length; i++) {
        count += selectedNodes[i - 1].length;
        isStartOfGroup[count] = true;
    }
    count = nodesByHop[0].length;
    for (let i = 1; i < neighArr.length; i++) {
        isStartOfGroup[count] = true;
        count += nodesByHop[i].length;
    }

    const alpha = 2;
    let curPos = 1;
    const remappedCoords = new Array(numNodes);
    for (let i = 0; i < numNodes; i++) {
        const d = Math.max(
            0.1,
            getNeighborDistance(masks[orderedNodes[i]], masks[orderedNodes[i - 1]], distMetric)
        );
        curPos += d;
        if (isStartOfGroup[i]) {
            curPos += gapBetweenHop;
        }

        const r = alpha * curPos;
        remappedCoords[i] = { x: r * Math.cos(curPos), y: r * Math.sin(curPos) };
    }

    // Move the coordinates such that (0,0) is on the top left for rendering
    const xExtent = extent(remappedCoords.map((c) => c.x));
    const yExtent = extent(remappedCoords.map((c) => c.y));
    console.log({ xExtent, yExtent });
    const width = xExtent[1] - xExtent[0] + 2 * padding;
    const height = yExtent[1] - yExtent[0] + 2 * padding;

    const coords = new Array(state.numNodes);
    for (let i = 0; i < remappedCoords.length; i++) {
        coords[orderedNodes[i]] = {
            x: remappedCoords[i].x - xExtent[0] + padding,
            y: remappedCoords[i].y - yExtent[0] + padding,
        };
    }

    return { name: "Space-filling curve", coords, width, height, numNodes, numEdges: remappedEdges.length };
}

Comlink.expose({
    initializeState,
    computeFocalLayoutWithCola,
    computeFocalLayoutWithD3,
    computeFocalLayoutWithUMAP,
    computeSpaceFillingCurveLayout,
    performEdgeBundling,
});
