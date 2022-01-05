import produce, { freeze } from "immer";
import initialState from "./initialState";
import ACTION_TYPES from "./actions";
import bs from "bitset";
import {
    bin as d3bin,
    extent,
    max,
    scaleSequential,
    interpolateGreens,
    interpolateGreys,
    scaleLinear,
    scaleOrdinal,
    schemeTableau10,
} from "d3";
import Quadtree from "@timohausmann/quadtree-js";
import {
    aggregateBinaryFeatures,
    compressFeatureValues,
    getCompressFeatureMapping,
    coordsRescale,
    getNodeEmbeddingColor,
    rectBinning,
} from "./utils";

function mapColorToNodeType(nodeTypes) {
    for (let i = 0; i < nodeTypes.length; i++) {
        if (i > schemeTableau10.length - 1) {
            nodeTypes[i].color = "black";
        } else {
            nodeTypes[i].color = schemeTableau10[i];
        }
    }
}

function countNeighborsByType(neighborMasksByType, selectedNodes) {
    // Not including itself
    let nei = [];
    for (let i = 0; i < neighborMasksByType[0].length; i++) {
        nei.push(bs(0));
    }
    for (let i of selectedNodes) {
        for (let j = 0; j < neighborMasksByType[i].length; j++) {
            nei[j] = nei[j].or(neighborMasksByType[i][j]);
        }
    }
    return nei.map((n) => n.cardinality());
}

function getNeighborMasksByType(nodes, edges, numberOfNodeTypes) {
    // Init the masks for each node: an array of array of zero masks
    let masks = nodes.map(() => {
        let m = [];
        for (let i = 0; i < numberOfNodeTypes; i++) {
            m.push(bs(0));
        }
        return m;
    });

    for (let e of edges) {
        const sid = e.source,
            tid = e.target;
        const srcType = nodes[sid].typeId,
            tgtType = nodes[tid].typeId;
        masks[sid][tgtType].set(tid, 1);
        masks[tid][srcType].set(sid, 1);
    }
    return masks;
}

function getNeighbors(neighborMasks, hops, edgeDict, targetNodes, incTargets = true) {
    const hash = {};
    if (incTargets) {
        for (let tar of targetNodes) {
            hash[tar] = true;
        }
    }

    for (let i = 0; i < hops; i++) {
        // Iterate the hops
        // Flatten all hops / treating all hops the same
        for (let tar of targetNodes) {
            for (let id of neighborMasks[i][tar].toArray()) {
                hash[id] = true;
            }
        }
    }
    const nodes = Object.keys(hash).map((x) => parseInt(x));
    return { nodes, edges: getEdgesWithinGroup(edgeDict, nodes, hash) };
}

function getEdgesWithinGroup(edgeDict, nodes, nodeHash = null) {
    let h = nodeHash;
    if (nodeHash === null) {
        h = {};
        for (let id of nodes) {
            h[id] = true;
        }
    }

    const edges = [];
    for (let id of nodes) {
        for (let id2struct of edgeDict[id]) {
            const id2 = id2struct.nid;
            if (id < id2 && h[id2]) {
                edges.push({ source: id, target: id2, eid: id2struct.eid });
            }
        }
    }
    return edges;
}

// Return an array of all combinations of intersection, represented as bitsets of the selectedNodes
// Total number of combo is 2^n - 1 - n, where n is the number of selected nodes
// O(2^n)
function generateIntersectionCombo(n) {
    let combos = [];
    for (let i = 1; i <= n; i++) {
        // Iterate over the number of sets to intersect
        let cur = bs(0);
        function search(start, ones) {
            if (ones === 0) {
                // save this bs
                combos.push(cur.clone());
                return;
            }
            for (let j = start; j <= n - ones; j++) {
                cur.set(j, 1);
                search(j + 1, ones - 1);
                cur.set(j, 0);
            }
        }
        search(0, i);
    }
    // console.log(combos.map(c => c.toString()));
    return combos;
}

// function computeIntersections(neighborMasksByType, selectedNodes) {
//     if (selectedNodes.length < 2) {
//         return null;
//     }
//     const combos = generateIntersectionCombo(selectedNodes.length);
//     let intersections = [];
//     // This is potentially slow due to spatial locality
//     // And the combo bitset is duped
//     for (let i = 0; i < neighborMasksByType[0].length; i++) {
//         intersections.push(
//             combos.map((c) => {
//                 const bits = c.toArray();
//                 let r = bs(0).flip();
//                 for (let b of bits) {
//                     const nodeIdx = selectedNodes[b];
//                     r = r.and(neighborMasksByType[nodeIdx][i]);
//                 }
//                 return { combo: c, res: r, size: r.cardinality() };
//             })
//         );
//     }
//     return intersections;
// }

// TODO selectNodes is now an array of array fix this!!!
// Count frequency of a neighbor presenting in the neighbor sets of the selected nodes
// Return an array, each item in the array is an object with the node id and frequencies, sorted by node types.
// Quadratic time to the number of nodes.  Potentially we can apply incremental changes and reduce computation
// TODO: use frequency as second sort key?
// Also compute the bins of histogram
// Note: return one histogram for each neighbor node type.  The input is already sorted
function countNeighborSets(neighborMasksByType, selectedNodes) {
    if (selectedNodes.length === 0) return { allCounts: [], bins: [], countsByType: [] };

    // Init
    let cnts = [],
        histos = [];
    for (let i = 0; i < neighborMasksByType[0].length; i++) {
        cnts.push({});
    }

    // Count
    for (let nid of selectedNodes) {
        for (let i = 0; i < neighborMasksByType[0].length; i++) {
            const nei = neighborMasksByType[nid][i].toArray();
            for (let b of nei) {
                if (!cnts[i].hasOwnProperty(b)) {
                    cnts[i][b] = 0;
                }
                cnts[i][b]++;
            }
        }
    }

    // TODO:  use a smarter thresholds later
    // const thresholds = [];
    // for (let i = 1; i < selectedNodes.length + 1; i++) {
    //    thresholds.push(i - 0.01);
    // }
    // console.log(thresholds);
    const binGen = d3bin().thresholds(selectedNodes.length);

    // Flatten the cnts array
    let allCounts = [],
        allCountsMapping = {},
        countsByType = [];
    for (let c of cnts) {
        const idx = Object.keys(c);
        const temp = [];
        for (let i of idx) {
            temp.push({ id: i, cnt: c[i] });
            allCountsMapping[i] = c[i];
        }
        // Sort
        temp.sort((a, b) => b.cnt - a.cnt);
        allCounts = allCounts.concat(temp);
        countsByType.push(temp);
        // Compute bins of counts
        histos.push(binGen(temp.map((t) => t.cnt)));
    }
    return { allCounts, allCountsMapping, bins: histos, countsByType };
}

function countSelectedNeighborsByHop(neighborMasks, selectedNodes, neighArr, neighMap) {
    if (selectedNodes.length === 0) return {};

    let neighGrp = [];
    // Merge the selected nodes into an flat array
    let prevHopNodes = selectedNodes.flat();

    // iterate the masks for each hop
    let h = 0;
    for (let curHopNeigh of neighArr) {
        // Group the neighbors by frequency
        let idx = 0;
        let curGroups = [];
        while (idx < curHopNeigh.length) {
            let curG = {
                freq: neighMap[curHopNeigh[idx]].cnt,
                prevTotal: idx, // Number of neighbors previous to this group, used for computing layout
                nodes: [],
                expanded: false,
                cntsPerSelected: {}, // For roll-up matrix
                nodesPerSelected: {}, // For highlighting in the roll-up matrix
                subgroups: [],
                subGroupPrevTotal: [], // Number of neighbors previous to this subgroup (count within this group)
                isBoundary: {}, // For drawing visual boundary lines
            };
            for (let nodeId of prevHopNodes) {
                curG.cntsPerSelected[nodeId] = 0;
                curG.nodesPerSelected[nodeId] = [];
            }

            let j = idx;
            while (j < curHopNeigh.length) {
                let curNeighData = neighMap[curHopNeigh[j]];
                if (curNeighData.cnt !== curG.freq) break;
                curG.nodes.push(curHopNeigh[j]);

                // Compute the counts per prev-hop node
                for (let nodeId of prevHopNodes) {
                    const m = neighborMasks[0][nodeId];
                    if (m.get(curHopNeigh[j])) {
                        curG.cntsPerSelected[nodeId]++;
                        curG.nodesPerSelected[nodeId].push(curHopNeigh[j]);
                    }
                }

                // Compute the subgroups by comparing neighbor j with j-1
                if (j === idx || !curNeighData.mask.equals(neighMap[curHopNeigh[j - 1]].mask)) {
                    // add a new subgroup
                    curG.subgroups.push([curHopNeigh[j]]);
                    curG.subGroupPrevTotal.push(j - idx); // count within this group
                    curG.isBoundary[curHopNeigh[j]] = true;
                } else {
                    curG.subgroups[curG.subgroups.length - 1].push(curHopNeigh[j]);
                }

                j++;
            }
            curGroups.push(curG);
            idx = j;
        }

        neighGrp.push(curGroups);
        prevHopNodes = curHopNeigh;
        h++;
    }

    console.log({ neighGrp });
    // Note that cnts does not have info about hop
    return neighGrp;
}

// function computeDistanceToCurrentFocus(distMatrix, focalNodes) {
//     if (focalNodes.length === 0) {
//         return null;
//     }
//     const d = [];
//     for (let i = 0; i < distMatrix.length; i++) {
//         let t = 0;
//         for (let nodeId of focalNodes) {
//             t += distMatrix[i][nodeId];
//         }
//         d.push(t / focalNodes.length);
//     }
//     console.log({ extent: extent(d) });
//     return d;
// }

// Note that attrs will be changed by calling this function
// attrMeta is an array of object that describes the attribute names and types
// attrs is the histogram data for all nodes (for computing sub-distribution of selected nodes)
function summarizeNodeAttrs(nodes, attrMeta, nodeTypes, attrs = null, included = null) {
    let res = attrMeta.map((a) => ({ ...a }));
    // Init
    for (let a of res) {
        if (a.type === "scalar") {
            a.values = []; // The attribute values, used for compuing stats
        } else if (a.type === "categorical") {
            a.values = {}; // A mapping from value to count
        }
        // if (included) {
        //     // Only record the nodes when computing partial histogram data
        //     a.nodeIds = [];
        // }
    }

    // Count
    function countValues(n) {
        for (let a of res) {
            if (nodeTypes[n.typeId].name === a.nodeType) {
                if (a.type === "scalar") {
                    a.values.push(+n[a.name]);
                } else if (a.type === "categorical") {
                    if (!a.values.hasOwnProperty(n[a.name])) {
                        a.values[n[a.name]] = 0;
                    }
                    a.values[n[a.name]]++;
                }
                // if (included) {
                //     a.nodeIds.push(n.id);
                // }
            }
        }
    }

    if (included !== null) {
        for (let nid of included) {
            countValues(nodes[nid]);
        }
    } else {
        for (let n of nodes) {
            countValues(n);
        }
    }
    // Binning
    const thresCnt = 10;
    for (let i = 0; i < res.length; i++) {
        let a = res[i];
        if (a.type === "scalar") {
            if (attrs) {
                a.bins = attrs[i].binGen(a.values);
            } else {
                let s = scaleLinear().domain(extent(a.values)).nice(thresCnt);
                a.binGen = d3bin().domain(s.domain()).thresholds(s.ticks(thresCnt));
                a.bins = a.binGen(a.values);
            }
        } else {
            if (attrs) {
                a.bins = attrs[i].bins.map((b) => ({ v: b.v, c: a.values[b.v] }));
            } else {
                a.bins = Object.keys(a.values)
                    .sort((x, y) => a.values[x] - a.values[y])
                    .map((x) => ({ v: x, c: a.values[x] }));
            }
        }
    }
    return res;
}

function computeBoundingBox(coords, included) {
    let xMin = 1e9,
        xMax = 0,
        yMin = 1e9,
        yMax = 0;
    const padding = 5;
    for (let nid of included) {
        const c = coords[nid];
        xMin = Math.min(xMin, c.x);
        xMax = Math.max(xMax, c.x);
        yMin = Math.min(yMin, c.y);
        yMax = Math.max(yMax, c.y);
    }
    return {
        x: xMin - padding,
        y: yMin - padding,
        width: xMax - xMin + 2 * padding,
        height: yMax - yMin + 2 * padding,
    };
}

function processPredictionResults(nodes, edges, predRes) {
    if (!predRes) return;
    if (predRes.trueLabels && predRes.predLabels) {
        // node classification results
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            n.pl = predRes.predLabels[i];
            n.tl = predRes.trueLabels[i];
            n.isWrong = n.pl !== n.tl;
        }
    }
    if (predRes.trueAllowEdges && predRes.falseAllowEdges) {
        // link prediction results
        const h = [];
        for (let i = 0; i < nodes.length; i++) {
            h[i] = {};
            nodes[i].isWrong = false;
        }
        for (let p of predRes.trueAllowEdges) {
            h[p[0]][p[1]] = true;
            h[p[1]][p[0]] = true;
        }
        for (let p of predRes.falseAllowEdges) {
            h[p[0]][p[1]] = false;
            h[p[1]][p[0]] = false;
        }

        for (let e of edges) {
            if (!h[e.source][e.target]) {
                // Mark the node as wrong prediction
                nodes[e.source].isWrong = true;
                nodes[e.target].isWrong = true;
                e.isWrong = true;
            } else {
                e.isWrong = false;
            }
        }
    }
}

// const getIntraDistances = (nodes, distMatrix) => {
//     const n = nodes.length;
//     const d = [];
//     for (let i = 0; i < n; i++) {
//         for (let j = i + 1; j < n; j++) {
//             d.push([distMatrix[nodes[i]][nodes[j]], nodes[i], nodes[j]]);
//         }
//     }
//     d.sort((x1, x2) => x1[0] - x2[0]);
//     return d;
// };

// // Return the distance distributions for the focal groups
// // In the case of two focal group with only one node in each, return one distance value
// function computeDistancesFocal(selectedNodes, distMatrix, binGen) {
//     let res = [];
//     if (selectedNodes.length == 1 && selectedNodes[0].length > 1) {
//         const d = {
//             mode: "within focal group",
//             nodePairs: getIntraDistances(selectedNodes[0], distMatrix),
//         };
//         d.bins = binGen(d.nodePairs.map((x) => x[0]));
//         res.push(d);
//     } else if (selectedNodes.length > 1) {
//         for (let k = 0; k < selectedNodes.length; k++) {
//             if (selectedNodes[k].length > 1) {
//                 const d = {
//                     mode: `within focal group ${k}`,
//                     nodePairs: getIntraDistances(selectedNodes[k], distMatrix),
//                 };
//                 d.bins = binGen(d.nodePairs.map((x) => x[0]));
//                 res.push(d);
//             }
//         }
//         if (selectedNodes.length == 2) {
//             const n1 = selectedNodes[0].length,
//                 n2 = selectedNodes[1].length;
//             if (n1 > 1 || n2 > 1) {
//                 const d2 = { mode: "between two focal groups", nodePairs: [] };
//                 for (let i = 0; i < n1; i++) {
//                     for (let j = 0; j < n2; j++) {
//                         const a = selectedNodes[0][i],
//                             b = selectedNodes[1][j];
//                         d2.nodePairs.push([distMatrix[a][b], a, b]);
//                     }
//                 }
//                 d2.bins = binGen(d2.nodePairs.map((x) => x[0]));
//                 res.push(d2);
//             } else if (n1 == 1 && n2 == 1) {
//                 res = distMatrix[selectedNodes[0][0]][selectedNodes[1][0]];
//             }
//         }
//     }
//     return res;
// }

function setNodeColors(draft, colorBy) {
    let s = null,
        d = [];
    switch (colorBy) {
        case "umap":
            draft.nodeColors = draft.latent.posColor;
            break;
        case "pred-labels":
            for (let i = 0; i < draft.numNodeClasses; i++) {
                d.push(i);
            }
            s = scaleOrdinal(d, schemeTableau10);
            draft.nodeColors = draft.graph.nodes.map((n) => s(n.pl));
            break;
        case "true-labels":
            for (let i = 0; i < draft.numNodeClasses; i++) {
                d.push(i);
            }
            s = scaleOrdinal(d, schemeTableau10);
            draft.nodeColors = draft.graph.nodes.map((n) => s(n.tl));
            break;
        case "correctness":
            s = (isWrong) => (isWrong ? "red" : "blue");
            draft.nodeColors = draft.graph.nodes.map((n) => s(n.isWrong));
            break;
        case "node-type":
            s = (i) => draft.graph.nodeTypes[i].color;
            draft.nodeColors = draft.graph.nodes.map((n) => s(n.typeId));
            break;
        default:
            colorBy = parseInt(colorBy);
            const colorAttr = draft.nodeAttrs.display[0].data[colorBy];
            const attrDomain = [colorAttr.bins[0].x0, colorAttr.bins[colorAttr.bins.length - 1].x1];
            const leftMargin = 0.2 * (attrDomain[1] - attrDomain[0]);
            s = scaleSequential(interpolateGreens).domain([
                attrDomain[0] > 0 ? Math.max(0, attrDomain[0] - leftMargin) : attrDomain[0],
                attrDomain[1],
            ]);
            draft.nodeColors = draft.graph.nodes.map((n) =>
                n.hasOwnProperty(colorAttr.name) ? s(n[colorAttr.name]) : "black"
            );
    }
    draft.param.colorBy = colorBy;
    draft.param.colorScale = s;
}

// Determine if all nodes are in a focal group.  If yes return the gid (>0), else return 0
function findFocalGroups(nodes, isNodeSelected) {
    let r = 0;
    if (nodes.length === 2) {
        // determine if the two nodes between to two different focal group respectively
        const g1 = isNodeSelected[nodes[0]],
            g2 = isNodeSelected[nodes[1]];
        if (g1 > 0 && g2 > 0 && g1 !== g2) {
            return Math.max(g1, g2) + 1;
        }
    } else {
        for (let nid of nodes) {
            if (isNodeSelected[nid]) {
                if (r > 0 && isNodeSelected[nid] !== r) {
                    // Other nodes are in the focal group r, but this one is not in r or not focal node
                    return 0;
                }
                r = isNodeSelected[nid];
            } else if (r > 0) {
                // Other nodes are in the focal group, but this one is not
                return 0;
            }
        }
    }
    return r;
}

function clearHighlights(draft) {
    draft.param.nodeFilter = { searchShown: false };
    draft.highlightedNodes = [];
    draft.highlightedEdges = [];
    draft.featureAgg.highlighted = null;
    draft.nodeAttrs.highlighted = null;
}

function buildQT(layoutData) {
    const { coords, width, height } = layoutData;
    const qt = new Quadtree({
        x: 0,
        y: 0,
        width,
        height,
    });
    for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        if (c) {
            qt.insert({
                id: i,
                x: c.x - 0.5,
                y: c.y - 0.5,
                width: 1,
                height: 1,
            });
        }
    }
    return qt;
}

function filterPairsByFormCondition(state, formData) {
    const { userInterests, connectivity, linkPrediction } = formData;
    const n = state.graph.nodes.length;
    const { highlightedNodes, selectedNodes, predRes } = state;
    let temp, g0, g1, g, x, y;
    let h1 = {},
        h2 = {},
        h3 = {};
    for (let i = 0; i < n; i++) {
        h1[i] = {};
        h2[i] = {};
        h3[i] = {};
    }
    let allConn = false,
        allUser = false,
        allPred = false;

    // for debug
    function countT(h) {
        let cnt = 0;
        for (let i = 0; i < n; i++) {
            for (let id in h[i])
                if (h[i].hasOwnProperty(id) && h[i][id]) {
                    cnt++;
                }
        }
        return cnt;
    }

    // filter by connectivity
    if (connectivity === "edge") {
        for (let e of state.graph.edges) {
            x = Math.min(e.source, e.target);
            y = Math.max(e.source, e.target);
            h1[x][y] = true;
        }
    } else if (connectivity === "nonedge") {
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                h1[i][j] = true;
            }
        }
        for (let e of state.graph.edges) {
            h1[Math.min(e.source, e.target)][Math.max(e.source, e.target)] = false;
        }
    } else {
        allConn = true;
    }
    // console.log("after connectivity: ", countT(h1));

    if (userInterests !== "all") {
        if (userInterests.indexOf("*") !== -1) {
            // between focal groups
            temp = userInterests.split("*");
            g0 = parseInt(temp[0].slice(4));
            g1 = parseInt(temp[1].slice(4));
            console.assert(g0 !== g1 && g0 < selectedNodes.length && g1 < selectedNodes.length);
            for (let id1 of selectedNodes[g0]) {
                for (let id2 of selectedNodes[g1]) {
                    x = Math.min(id1, id2);
                    y = Math.max(id1, id2);
                    if (allConn || h1[x][y]) {
                        h2[x][y] = true;
                    }
                }
            }
        } else if (userInterests.indexOf("-") !== -1) {
            // within a focal group
            g0 = parseInt(userInterests.slice(4));
            console.assert(g0 !== g1 && g0 < selectedNodes.length);
            g = selectedNodes[g0];
            for (let i = 0; i < g.length; i++) {
                for (let j = i + 1; j < g.length; j++) {
                    x = Math.min(g[i], g[j]);
                    y = Math.max(g[i], g[j]);
                    if (allConn || h1[x][y]) {
                        h2[x][y] = true;
                    }
                }
            }
        } else {
            // hihglight
            g = highlightedNodes;
            for (let i = 0; i < g.length; i++) {
                for (let j = i + 1; j < g.length; j++) {
                    x = Math.min(g[i], g[j]);
                    y = Math.max(g[i], g[j]);
                    if (allConn || h1[x][y]) {
                        h2[x][y] = true;
                    }
                }
            }
        }
    } else {
        allUser = true;
    }

    // console.log("after user interests: ", countT(h2));

    // filter by link prediction
    if (linkPrediction === "pred-true") {
        const { trueAllowEdges } = state.predRes;
        for (let e of trueAllowEdges) {
            x = Math.min(e[0], e[1]);
            y = Math.max(e[0], e[1]);
            if ((allConn || h1[x][y]) && (allUser || h2[x][y])) {
                h3[x][y] = true;
            }
        }
    } else if (linkPrediction === "pred-false") {
        const { falseAllowEdges } = state.predRes;
        for (let e of falseAllowEdges) {
            x = Math.min(e[0], e[1]);
            y = Math.max(e[0], e[1]);
            if ((allConn || h1[x][y]) && (allUser || h2[x][y])) {
                h3[x][y] = true;
            }
        }
    } else {
        allPred = true;
    }
    // console.log("after link prediction: ", countT(h3));

    const pairs = [];
    let h = null;
    if (!allConn) h = h1;
    if (!allUser) h = h2;
    if (!allPred) h = h3;
    if (!h) {
        // All "all"
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                pairs.push([i, j]);
            }
        }
    } else {
        // convert h to pairs
        for (let i = 0; i < n; i++) {
            for (let id in h[i])
                if (h[i].hasOwnProperty(id) && h[i][id]) {
                    pairs.push([i, id]);
                }
        }
    }
    return pairs;
}

function getSpecialDistanceTitle(formData) {
    const { userInterests, connectivity, linkPrediction } = formData;
    const t = [userInterests, connectivity, linkPrediction].filter((x) => x !== "all");
    let f;
    if (t.length) {
        f = t.join(",");
    } else {
        f = "all";
    }
    return `Filter: ${f}`;
}

const reducers = produce((draft, action) => {
    // const ascFunc = (x1, x2) => x1[0][0] - x2[0][0],
    //     descFunc = (x1, x2) => x2[0][0] - x1[0][0];
    let neiRes, fAggCntData, fAggBlock, fidMapping;
    switch (action.type) {
        case ACTION_TYPES.FETCH_DATA_PENDING:
            draft.loaded = false;
            return;
        case ACTION_TYPES.FETCH_DATA_ERROR:
            draft.loaded = false;
            draft.error = action.error;
            return;
        case ACTION_TYPES.FETCH_DATA_SUCCESS:
            draft.loaded = true;
            const { graph, emb, emb2d, attrs, hops, predRes, initialLayout, distances } = action.data;
            // the scalar values in emb are in string format, so convert them to float first
            for (let e of emb) {
                for (let i = 0; i < e.length; i++) {
                    e[i] = parseFloat(e[i]);
                }
            }

            draft.predRes = predRes;
            processPredictionResults(graph.nodes, graph.edges, predRes);
            draft.numNodeClasses = predRes ? predRes.numNodeClasses : null;
            draft.hasLinkPredictions = predRes && predRes.isLinkPrediction;

            draft.param.hops = hops;
            draft.datasetId = action.data.datasetId;
            draft.datasetName = action.data.graph.name;
            draft.graph = graph;
            draft.initialLayout.numNodes = graph.nodes.length;
            draft.initialLayout.numEdges = graph.edges.length;
            if (action.data.initialLayout) {
                Object.assign(draft.initialLayout, initialLayout);
                draft.initialLayout.running = false;
                draft.initialLayout.qt = buildQT(initialLayout);
            }

            // compute feature aggregation
            if (graph.sparseFeatures) {
                // TODO deal with general numerical features
                draft.featureAgg.active = true;
                draft.featureAgg.numFeatures = graph.sparseFeatures[0].length;
                draft.featureAgg.stripMapping = getCompressFeatureMapping(
                    graph.sparseFeatures[0].length,
                    draft.spec.feature.maxNumStrips
                );
                fAggCntData = aggregateBinaryFeatures(graph.sparseFeatures, null);
                fAggBlock = {
                    title: "All",
                    cnts: fAggCntData.cnts,
                    featToNid: fAggCntData.featToNid,
                    maxCnts: max(fAggCntData.cnts),
                    compressedCnts: compressFeatureValues(fAggCntData.cnts, draft.spec.feature.maxNumStrips),
                };
                fAggBlock.scale = scaleSequential(interpolateGreys).domain([0, fAggBlock.maxCnts]);
                draft.featureAgg.display.push(fAggBlock);
            }
            mapColorToNodeType(draft.graph.nodeTypes);

            // draft.graph.neighborMasksByHop = getNeighborMasksByHop(graph.nodes, graph.edges, draft.param.hops);
            // draft.graph.neighborMasksByType = getNeighborMasksByType(
            //     graph.nodes,
            //     graph.edges,
            //     draft.graph.nodeTypes.length,
            //     hops
            // );
            // Bug: only 1-hop is counted in the neighborMasksByType
            // draft.graph.neighborMasks = draft.graph.neighborMasksByType.map((m) =>
            //     m.reduce((acc, x) => acc.or(x), bs(0))
            // );
            // draft.graph.neighborMasks = computeNeighborMasks(draft.graph.nodes.length, draft.graph.edgeDict, draft.param.hops);

            draft.latent = {
                emb,
                layoutMin: {
                    ...coordsRescale(
                        emb2d,
                        draft.spec.latent.width,
                        draft.spec.latent.height,
                        draft.spec.latent.paddings
                    ),
                    width: draft.spec.latent.width,
                    height: draft.spec.latent.height,
                },
                layoutMax: {
                    ...coordsRescale(
                        emb2d,
                        draft.spec.latent.widthMax,
                        draft.spec.latent.heightMax,
                        draft.spec.latent.paddingsMax
                    ),
                    width: draft.spec.latent.widthMax,
                    height: draft.spec.latent.heightMax,
                },
                neighborPos: emb2d.neighborPos,
            };
            // Build quadtree for the embedding 2D coordinates
            draft.latent.layoutMin.qt = buildQT(draft.latent.layoutMin);
            draft.latent.layoutMax.qt = buildQT(draft.latent.layoutMax);
            draft.latent.posColor = draft.latent.layoutMin.coords.map((c) =>
                getNodeEmbeddingColor(c.x / draft.spec.latent.width, c.y / draft.spec.latent.height)
            );

            draft.attrMeta = attrs;
            draft.nodeAttrs.active = attrs.length > 0;
            if (draft.nodeAttrs.active) {
                draft.nodeAttrs.numAttrs = attrs.length;
                draft.nodeAttrs.display.push({
                    title: "All",
                    data: summarizeNodeAttrs(graph.nodes, attrs, draft.graph.nodeTypes),
                });
            }
            setNodeColors(draft, draft.param.colorBy);

            const numPairs = (graph.nodes.length * (graph.nodes.length - 1)) / 2;
            draft.distances.featureDistMax = distances.featureDistMax;
            draft.distances.display = [distances.distSample, distances.distEdge];
            draft.distances.display[0].title =
                numPairs > distances.distSample.src.length ? "random samples" : "all";
            draft.distances.display[1].title = "edges";
            if (distances.featureDistMax) {
                draft.distances.featureScale = scaleLinear()
                    .domain([0, distances.featureDistMax])
                    .range([0, 1]);
            }

            draft.isNodeSelected = new Array(graph.nodes.length).fill(false);
            return;

        case ACTION_TYPES.COMPUTE_INIT_LAYOUT_DONE:
            Object.assign(draft.initialLayout, action.layoutRes);
            draft.initialLayout.qt = buildQT(action.layoutRes);
            draft.initialLayout.running = false;
            return;

        case ACTION_TYPES.COMPUTE_DISTANCES_PENDING:
            draft.distances.displaySpecial[0] = {
                title: getSpecialDistanceTitle(draft.scatterplotForm),
                isComputing: true,
            };
            draft.scatterplotForm.show = false;
            return;

        case ACTION_TYPES.COMPUTE_DISTANCES_DONE:
            if (action.isSpecial) {
                // if (action.idx < draft.distances.displaySpecial.length) {
                // Object.assign(draft.distances.displaySpecial[action.idx], action.distData);
                // Only allow one special scatterplot
                Object.assign(draft.distances.displaySpecial[0], action.distData);
                draft.distances.displaySpecial[0].isComputing = false;
                // }
            } else {
                if (action.idx < draft.distances.display.length) {
                    Object.assign(draft.distances.display[action.idx], action.distData);
                    draft.distances.display[action.idx].isComputing = false;
                }
            }
            return;

        case ACTION_TYPES.HIGHLIGHT_NODES:
            clearHighlights(draft);
            if (action.fromView === "node-type") {
                for (let n of draft.graph.nodes) {
                    if (n.typeId === action.which) {
                        draft.highlightedNodes.push(n.id);
                    }
                }
                draft.highlightedEdges = getEdgesWithinGroup(
                    draft.graph.edgeDict,
                    draft.highlightedNodes,
                    null
                );
            } else if (action.fromView === "node-label") {
                const f = draft.param.colorBy === "pred-labels" ? "pl" : "tl";
                for (let n of draft.graph.nodes) {
                    if (n[f] === action.which) {
                        draft.highlightedNodes.push(n.id);
                    }
                }
                draft.highlightedEdges = getEdgesWithinGroup(
                    draft.graph.edgeDict,
                    draft.highlightedNodes,
                    null
                );
            } else {
                if (action.fromView === "node-attr") {
                    draft.param.nodeFilter.whichAttr = action.which.attr;
                    draft.param.nodeFilter.whichRow = action.which.row;
                    draft.param.nodeFilter.brushedArea = action.brushedArea;
                }
                if (action.fromView === "feature") {
                    fAggCntData = new Array(draft.featureAgg.numFeatures).fill(0);
                    for (let fid of action.which.cellIds) {
                        fAggCntData[fid] = 1;
                    }
                    draft.featureAgg.highlighted = {
                        displayId: action.which.displayId,
                        // cellIds: action.which.cellIds,
                        cnts: fAggCntData,
                        compressedCnts: compressFeatureValues(fAggCntData, draft.spec.feature.maxNumStrips),
                    };
                }
                if (
                    action.fromView === "node-attr" ||
                    action.fromView === "feature" ||
                    // action.fromView === "emb" ||
                    // action.fromView === "graph-edge" ||
                    draft.param.hopsHighlight === 0
                ) {
                    draft.highlightedNodes = action.nodeIndices;
                    draft.highlightedEdges = getEdgesWithinGroup(
                        draft.graph.edgeDict,
                        draft.highlightedNodes,
                        null
                    );
                } else {
                    // Highlight their neighbors as well
                    neiRes = getNeighbors(
                        draft.graph.neighborMasksByHop,
                        draft.param.hopsHighlight,
                        draft.graph.edgeDict,
                        action.nodeIndices,
                        true
                    );
                    draft.highlightedNodes = neiRes.nodes;
                    draft.highlightedEdges = neiRes.edges;
                }
            }

            if (draft.highlightedNodes.length) {
                if (draft.featureAgg.active && action.fromView !== "feature") {
                    // Compute which cell needs to be highlighted
                    fAggCntData = aggregateBinaryFeatures(
                        draft.graph.sparseFeatures,
                        draft.highlightedNodes,
                        false
                    );
                    draft.featureAgg.highlighted = {
                        displayId: findFocalGroups(draft.highlightedNodes, draft.isNodeSelected),
                        cnts: fAggCntData.cnts,
                        compressedCnts: compressFeatureValues(
                            fAggCntData.cnts,
                            draft.spec.feature.maxNumStrips
                        ),
                    };
                } else if (draft.nodeAttrs.active && action.fromView !== "node-attr") {
                    draft.nodeAttrs.highlighted = {
                        displayId: findFocalGroups(draft.highlightedNodes, draft.isNodeSelected),
                        data: summarizeNodeAttrs(
                            draft.graph.nodes,
                            draft.attrMeta,
                            draft.graph.nodeTypes,
                            draft.nodeAttrs.display[0].data,
                            draft.highlightedNodes
                        ),
                    };
                }
            }
            return;
        case ACTION_TYPES.HIGHLIGHT_NODE_PAIRS:
            const { brushedArea, which, brushedPairs, showTopkUnseen } = action;
            draft.param.nodePairFilter.isTopoVsLatent = action.isTopoVsLatent;
            draft.param.nodePairFilter.brushedArea = brushedArea;
            draft.param.nodePairFilter.which = which;
            if (which === null) {
                draft.highlightedNodePairs = [];
            } else {
                draft.highlightedNodePairs = brushedPairs;
            }
            if (showTopkUnseen) {
                const unseenDict = draft.predRes.trueUnseenEdgesSorted;
                for (let nid of draft.highlightedNodes) {
                    if (unseenDict.hasOwnProperty(nid)) {
                        for (let i = 0; i < Math.min(unseenDict[nid].length, draft.param.unseenTopK); i++) {
                            draft.highlightedNodePairs.push([nid, unseenDict[nid][i]]);
                        }
                    }
                }
            }
            return;
        case ACTION_TYPES.HOVER_NODE:
            if (action.nodeIdx === null) {
                draft.hoveredNodes = [];
                draft.hoveredNodesAndNeighbors = [];
                draft.hoveredEdges = [];
                draft.featureAgg.hovered = null;
                draft.nodeAttrs.hovered = null;
            } else {
                // Hover on a node
                draft.hoveredNodes = Number.isInteger(action.nodeIdx) ? [action.nodeIdx] : action.nodeIdx;
                if (draft.param.hopsHover === 0) {
                    draft.hoveredNodesAndNeighbors = draft.hoveredNodes.slice();
                    draft.hoveredEdges = getEdgesWithinGroup(draft.graph.edgeDict, draft.hoveredNodes, null);
                } else {
                    neiRes = getNeighbors(
                        draft.graph.neighborMasksByHop,
                        draft.param.hopsHover,
                        draft.graph.edgeDict,
                        draft.hoveredNodes,
                        true
                    );
                    draft.hoveredNodesAndNeighbors = neiRes.nodes;
                    draft.hoveredEdges = neiRes.edges;
                }
            }

            // Compute feature partial distribution for the relevant nodes
            if (draft.hoveredNodesAndNeighbors.length) {
                if (draft.featureAgg.active) {
                    if (action.fromFeature === null) {
                        // Handle the features of hovered nodes
                        fAggCntData = aggregateBinaryFeatures(
                            draft.graph.sparseFeatures,
                            draft.hoveredNodesAndNeighbors,
                            false
                        );
                        draft.featureAgg.hovered = {
                            displayId: findFocalGroups(draft.hoveredNodesAndNeighbors, draft.isNodeSelected),
                            cnts: fAggCntData.cnts,
                            compressedCnts: compressFeatureValues(
                                fAggCntData.cnts,
                                draft.spec.feature.maxNumStrips
                            ),
                        };
                    } else if (action.fromFeature.cellIds.length > 0) {
                        // also highlight some of the feature cells
                        fidMapping = {};
                        for (let fid of action.fromFeature.cellIds) {
                            fidMapping[fid] = 1;
                        }
                        draft.featureAgg.hovered = {
                            displayId: action.fromFeature.displayId,
                            cnts: fidMapping,
                        };
                    }
                }
                if (draft.nodeAttrs.active) {
                    draft.nodeAttrs.hovered = {
                        displayId: findFocalGroups(draft.hoveredNodesAndNeighbors, draft.isNodeSelected),
                        data: summarizeNodeAttrs(
                            draft.graph.nodes,
                            draft.attrMeta,
                            draft.graph.nodeTypes,
                            draft.nodeAttrs.display[0].data,
                            draft.hoveredNodesAndNeighbors
                        ),
                    };
                }
            }
            return;
        case ACTION_TYPES.SELECT_NODES_PENDING:
            let { newSel, neighRes } = action;
            draft.selectedNodes = newSel;
            // Remove the computation results for previous focal groups
            draft.distances.display.length = 2;
            draft.nodeAttrs.display.length = 1;
            draft.featureAgg.display.length = 1;
            draft.param.features.collapsed.length = 1;
            if (newSel.length == 0) {
                // Clear selection
                draft.neighArr = null;
                // draft.neighMap = null;
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
                draft.neighGrp = null;
                draft.focalLayout = { running: false };
            } else {
                draft.isNodeSelected = neighRes.isNodeSelected;
                draft.isNodeSelectedNeighbor = neighRes.isNodeSelectedNeighbor;
                // draft.neighMap = neighRes.neighMap;
                draft.neighArr = neighRes.neighArr;
                // neighGrp is for the roll-up matrix of neighbor counts
                // draft.neighGrp = countSelectedNeighborsByHop(
                //     draft.graph.neighborMasksByHop,
                //     draft.selectedNodes,
                //     neighRes.neighArr,
                //     neighRes.neighMap
                // );

                if (draft.nodeAttrs.active) {
                    for (let i = 0; i < newSel.length; i++) {
                        draft.nodeAttrs.display.push({
                            title: `foc-${i}`,
                            data: summarizeNodeAttrs(
                                draft.graph.nodes,
                                draft.attrMeta,
                                draft.graph.nodeTypes,
                                draft.nodeAttrs.display[0].data,
                                newSel[i]
                            ),
                        });
                    }
                }
                draft.focalLayout = {
                    running: true,
                    layoutId: action.layoutId,
                };
                draft.latent.layoutMin.focalBBox = newSel.map((s) =>
                    computeBoundingBox(draft.latent.layoutMin.coords, s)
                );
                draft.latent.layoutMax.focalBBox = newSel.map((s) =>
                    computeBoundingBox(draft.latent.layoutMax.coords, s)
                );

                // Compute the features for the focal nodes
                if (draft.featureAgg.active) {
                    newSel.map((s, i) => {
                        fAggCntData = aggregateBinaryFeatures(draft.graph.sparseFeatures, s);
                        fAggBlock = {
                            title: `foc-${i}`,
                            cnts: fAggCntData.cnts,
                            featToNid: fAggCntData.featToNid,
                            maxCnts: max(fAggCntData.cnts),
                            compressedCnts: compressFeatureValues(
                                fAggCntData.cnts,
                                draft.spec.feature.maxNumStrips
                            ),
                        };
                        fAggBlock.scale = scaleSequential(interpolateGreys).domain([0, fAggBlock.maxCnts]);
                        draft.featureAgg.display.push(fAggBlock);
                        draft.param.features.collapsed.push(true);
                    });
                    if (newSel.length === 2) {
                        // Compute the diff feature data
                        const diffCnts = draft.featureAgg.display[1].cnts.map((c1, i) =>
                            Math.abs(c1 - draft.featureAgg.display[2].cnts[i])
                        );
                        const diffMax = max(diffCnts);
                        // const t = Math.max(Math.abs(diffExtent[0]), Math.abs(diffExtent[1]));
                        // const t = Math.max(newSel[0].length, newSel[1].length);
                        const diffCompressedCnts = compressFeatureValues(
                            diffCnts,
                            draft.spec.feature.maxNumStrips
                        );
                        const diffFeatToNid = {};
                        for (let i = 0; i < diffCnts.length; i++) {
                            if (diffCnts[i] !== 0) {
                                let ftn1 = draft.featureAgg.display[1].featToNid[i] || [],
                                    ftn2 = draft.featureAgg.display[2].featToNid[i] || [];
                                diffFeatToNid[i] = ftn1.concat(ftn2);
                            }
                        }
                        draft.featureAgg.display.push({
                            title: "diff",
                            cnts: diffCnts,
                            compressedCnts: diffCompressedCnts,
                            featToNid: diffFeatToNid,
                            // scale: scaleSequential(interpolateRdBu).domain([-t, t]),
                            scale: scaleSequential(interpolateGreys).domain([0, diffMax]),
                        });
                        draft.param.features.collapsed.push(true);
                    }
                }
                // Allocate space for the distance data, waiting for worker to return the actual computed values
                for (let i = 0; i < newSel.length; i++) {
                    if (newSel[i].length > 1) {
                        draft.distances.display.push({ isComputing: true, title: `within foc-${i}` });
                    }
                }
                if (newSel.length === 2 && (newSel[0].length > 1 || newSel[1].length > 1)) {
                    draft.distances.display.push({
                        isComputing: true,
                        title: "between foc-0 and foc-1",
                    });
                }
                // Clear the highlight (blinking) nodes
                draft.param.nodeFilter = {};
                draft.highlightedNodes = [];
                draft.featureAgg.highlighted = null;
                draft.nodeAttrs.highlighted = null;
            }

            return;
        case ACTION_TYPES.SELECT_NODES_DONE:
            // Avoid racing condition
            if (action.layoutId && action.layoutId === draft.focalLayout.layoutId) {
                draft.focalLayout = {
                    ...action.layoutRes,
                    running: false,
                };
                if (action.layoutRes.coords) {
                    draft.focalLayout.qt = buildQT(action.layoutRes);
                }
            }
            return;
        case ACTION_TYPES.CHANGE_PARAM:
            const paramPath = action.param.split(".");
            const lastParam = paramPath[paramPath.length - 1];
            let cur = draft.param;
            for (let i = 0; i < paramPath.length - 1; i++) {
                cur = cur[paramPath[i]];
            }
            if (action.inverse) {
                if (action.arrayIdx !== null) {
                    cur[lastParam][action.arrayIdx] = !cur[lastParam][action.arrayIdx];
                } else {
                    cur[lastParam] = !cur[lastParam];
                }
            } else {
                if (action.arrayIdx !== null) {
                    cur[lastParam][action.arrayIdx] = action.value;
                } else {
                    cur[lastParam] = action.value;
                }
            }

            if (["hopsHighlight", "highlightNodeType", "highlightNodeLabel"].indexOf(action.param) !== -1) {
                clearHighlights(draft);
            }

            // Special param changes
            if (action.param === "colorBy") {
                setNodeColors(draft, action.value);
            }
            // else if (action.param === "nodePairFilter.ascending") {
            //     draft.highlightedNodePairs.sort(action.value ? ascFunc : descFunc);
            // }
            return;
        case ACTION_TYPES.CHANGE_FOCAL_PARAM_PENDING:
            if (action.runningMsg) {
                draft.focalLayout.runningMsg = action.runningMsg;
            } else {
                draft.focalLayout.running = true;
            }
            return;
        case ACTION_TYPES.CHANGE_FOCAL_PARAM_DONE:
            if (draft.focalLayout.layoutId === action.layoutId) {
                Object.assign(draft.focalLayout, { ...action.layoutRes, running: false, runningMsg: null });
                if (action.layoutRes.coords) {
                    draft.focalLayout.qt = buildQT(action.layoutRes);
                }
            }
            return;
        case ACTION_TYPES.CHANGE_HOPS:
            if (draft.param.hops !== action.hops) {
                draft.param.hops = action.hops;
                // Re-calculate the neighbor masks
                // draft.graph.neighborMasksByHop = getNeighborMasksByHop(
                //     draft.graph.nodes,
                //     draft.graph.edges,
                //     draft.param.hops
                // );
                // draft.graph.neighborMasksByType = getNeighborMasks(
                //     draft.graph.nodes,
                //     draft.graph.edges,
                //     draft.graph.nodeTypes.length,
                //     action.hops
                // );
                // draft.graph.neighborMasks = draft.graph.neighborMasksByType.map(m =>
                //     m.reduce((acc, x) => acc.or(x), bs(0))
                // );

                // Clear the selection
                draft.selectedNodes = [];
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
                draft.focalLayout = {};
            }
            return;
        case ACTION_TYPES.LAYOUT_TICK:
            // Note that in D3, the tick function returns the simulation object itself
            // In web-cola, the tick function returns whether the simulation has converged
            if (draft.focalLayout && draft.focalLayout.simulation) {
                const converged = draft.focalLayout.simulation.tick();
                draft.focalLayout.coords = draft.focalLayout.simulation.nodes().map((d) => ({
                    x: d.x,
                    y: d.y,
                    g: d.group,
                }));
                if (draft.param.focalGraph.layout === "group-constraint-cola") {
                    // This is only a dirty way for quick check
                    draft.focalLayout.groups = draft.focalLayout.simulation._groups.map((g) => ({
                        id: g.id,
                        bounds: g.bounds,
                    }));
                    if (converged || draft.focalLayout.simulationTickNumber > 20) {
                        // if (converged) {
                        draft.focalLayout.running = false;
                    }
                } else {
                    if (draft.focalLayout.simulationTickNumber === 50) {
                        draft.focalLayout.running = false;
                    }
                }
                draft.focalLayout.simulationTickNumber += 1;
            }
            return;

        // case ACTION_TYPES.CHANGE_EDGE_TYPE_STATE:
        //     draft.edgeAttributes.type.show[action.idx] = !draft.edgeAttributes.type.show[action.idx];
        //     return;

        case ACTION_TYPES.SEARCH_NODES:
            // Remove other node filters, e.g. node attributes
            draft.param.nodeFilter = { searchLabel: action.label, searchId: action.nodeIdx };
            if (action.label) {
                const l = action.label.toLowerCase();
                draft.highlightedNodes = draft.graph.nodes
                    .filter((n) => n.label && n.label.toString().toLowerCase().includes(l))
                    .map((n) => n.id);
            } else if (
                action.nodeIdx !== null &&
                0 <= action.nodeIdx &&
                action.nodeIdx < draft.graph.nodes.length
            ) {
                draft.highlightedNodes = [action.nodeIdx];
            } else {
                draft.highlightedNodes = [];
            }
            return;

        case ACTION_TYPES.CHANGE_SCATTERPLOT_FORM:
            const formData = draft.scatterplotForm;
            formData[action.field] = action.value;

            if (action.field === "show" && action.value) {
                // avoid invalid form data
                formData.userInterests = "all";
            }

            // compute pairs that fulfill the current condition
            formData.nodePairs = filterPairsByFormCondition(draft, formData);
            return;
        default:
            return;
    }
}, initialState);

export default reducers;
