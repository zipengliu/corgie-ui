import * as Comlink from "comlink";
import { UMAP } from "umap-js";
import bs from "bitset";
import { scaleLinear, forceSimulation, forceManyBody, forceCollide, forceLink } from "d3";
import { getNeighborDistance } from "./utils";
import seedrandom from "seedrandom";

const state = {
    distMetric: null,
    neighborMasks: null,
    neighborMasks1hop: null,
};

function initializeState(neighborMasks, neighborMasks1hop, distMetric) {
    state.neighborMasks = neighborMasks.map((m) => bs(m));
    state.neighborMasks1hop = neighborMasks1hop.map((m) => bs(m));
    state.distMetric = distMetric;
}

const minNNeigh = 15,
    maxNNeigh = 25;
const nNeighScale = scaleLinear().domain([minNNeigh, 1000]).range([minNNeigh, maxNNeigh]).clamp(true);
// const minDistScale = scaleLinear()
//     .domain([minNNeigh, 1000])
//     .range([0.2, 0.05])
//     .clamp(true);
const minDistScale = () => 0.1;

const runUMAP = (nodeIdxArr, useGlobalMask, nodeSize) => {
    const masks = useGlobalMask ? state.neighborMasks : state.neighborMasks1hop;
    const n = nodeIdxArr.length;

    if (n <= minNNeigh) {
        // Not enough data to compute UMAP, so we use D3 with edges within this group
        // return nodeIdxArr.map((_) => [Math.random(), Math.random()]);
        console.log("Calling D3... #nodes =", n);
        const coords = nodeIdxArr.map((_, i) => ({ index: i }));
        const mapping = {};
        for (let i = 0; i < n; i++) {
            mapping[nodeIdxArr[i]] = i;
        }
        const links = [];
        for (let id1 in mapping)
            if (mapping.hasOwnProperty(id1)) {
                for (let id2 in mapping)
                    if (id1 < id2 && mapping.hasOwnProperty(id2)) {
                        links.push({
                            source: mapping[id1],
                            target: mapping[id2],
                            dist: getNeighborDistance(masks[id1], masks[id2], state.distMetric),
                        });
                    }
            }
        // very small number of nodes so we can afford loops
        // const withinEdges = [];
        // for (let i = 0; i < nodeIdxArr.length; i++) {
        //     const nidi = nodeIdxArr[i];
        //     for (let j = i + 1; j < nodeIdxArr.length; j++) {
        //         const nidj = nodeIdxArr[j];
        //         if (edgeDict[nidi].hasOwnProperty(nidj.toString())) {
        //             withinEdges.push({ source: i, target: j });
        //         }
        //     }
        // }
        let simulation = forceSimulation(coords)
            // .force("edge", forceLink(withinEdges))
            .force(
                "topolink",
                forceLink(links).distance((d) => (1 + d.dist) * 20)
            )
            .force("charge", forceManyBody().strength(-30))
            .force("collide", forceCollide().radius(nodeSize + 1))
            // .force("center", forceCenter(50, 50))   // imaging a 100x100 bounding box
            .stop();
        simulation.tick(300);
        return coords.map((c) => [c.x, c.y]);
    } else {
        const distFunc = (x, y) => getNeighborDistance(masks[x], masks[y], state.distMetric); // Global signature
        const rng = seedrandom("hello.");
        const umapParams = {
            distanceFn: distFunc,
            nNeighbors: Math.round(nNeighScale(n)),
            minDist: minDistScale(n),
            random: rng,
        };
        const sim = new UMAP(umapParams);
        console.log("Calling UMAP... #nodes =", n, " params = ", umapParams);
        return sim.fit(nodeIdxArr);
    }
};

Comlink.expose({
    initializeState,
    runUMAP,
});
