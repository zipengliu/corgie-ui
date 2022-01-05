import * as Comlink from "comlink";
import { bin as d3bin, scaleLinear, extent } from "d3";
import bs from "bitset";
import { getNeighborDistance, getCosineDistance, getEuclideanDistance, rectBinning } from "./utils";

// Store some big objects in the worker thread to avoid data transmission
let state = {
    emb: null,
    features: null,
    nodeTypeIds: null, // array of typeId for each node
    edges: null,
    neighborMasks: null,
    distMetric: null,
    numBins: null,
    distMatLatent: null,
    distMatTopo: null,
    distMatFeature: null,
    featureDistMax: null,
};

function initializeState(
    emb,
    numNodes,
    edges,
    neighborMasks,
    features,
    featureDistMax,
    nodeTypeIds,
    distMetric,
    numBins
) {
    state.emb = emb;
    state.numNodes = numNodes;
    state.edges = edges;
    state.neighborMasks = neighborMasks.map((m) => bs(m));
    state.features = features;
    state.nodeTypeIds = nodeTypeIds;
    state.distMetric = distMetric;
    state.numBins = numBins;
    state.featureDistMax = featureDistMax;
    state.featureScale = scaleLinear().domain([0, featureDistMax]).range([0, 1]);

    function initDistMat(n) {
        let d = {};
        for (let i = 0; i < n; i++) {
            d[i] = { [i]: 0 };
        }
        return d;
    }
    state.distMatLatent = initDistMat(numNodes);
    state.distMatTopo = initDistMat(numNodes);
    state.distMatFeature = features ? initDistMat(numNodes) : null;
}

function computeDistances(mode, targetNodes = null, maxNumPairs = 0, targetPairs = null) {
    console.log("Computing distances ...");
    const startTime = new Date();

    const n = state.numNodes;
    const { distMatLatent, distMatTopo, distMatFeature, emb, neighborMasks, nodeTypeIds, features } = state;

    let numPairs, pairGen;
    if (mode === "all") {
        numPairs = (n * (n - 1)) / 2;
        pairGen = function* () {
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    yield [i, j];
                }
            }
        };
    } else if (mode === "sample") {
        numPairs = Math.min((n * (n - 1)) / 2, maxNumPairs);
        pairGen = function* () {
            const dup = {};
            // sample node pairs
            const maxSeqNum = n * (n - 1);
            let x;
            for (let i = 0; i < numPairs; i++) {
                do {
                    x = Math.floor(Math.random() * maxSeqNum);
                } while (dup[x]);
                dup[x] = true;
                let s = Math.floor(x / (n - 1)),
                    t = x % (n - 1);
                if (t >= s) {
                    t++;
                }
                yield [s, t];
            }
        };
    } else if (mode === "edge") {
        numPairs = state.edges.length;
        pairGen = function* () {
            for (let e of state.edges) {
                yield [e.source, e.target];
            }
        };
    } else if (mode === "within") {
        numPairs = (targetNodes.length * (targetNodes.length - 1)) / 2;
        pairGen = function* () {
            for (let i = 0; i < targetNodes.length; i++) {
                for (let j = i + 1; j < targetNodes.length; j++) {
                    yield [targetNodes[i], targetNodes[j]];
                }
            }
        };
    } else if (mode === "between") {
        numPairs = targetNodes[0].length * targetNodes[1].length;
        pairGen = function* () {
            for (let i = 0; i < targetNodes[0].length; i++) {
                for (let j = 0; j < targetNodes[1].length; j++) {
                    yield [targetNodes[0][i], targetNodes[1][j]];
                }
            }
        };
    } else if (mode === "special") {
        numPairs = targetPairs.length;
        pairGen = function* () {
            for (let p of targetPairs) {
                yield p;
            }
        };
    }

    const srcArrayBuffer = new ArrayBuffer(numPairs * 2),
        srcBuf = new Uint16Array(srcArrayBuffer),
        tgtArrayBuffer = new ArrayBuffer(numPairs * 2),
        tgtBuf = new Uint16Array(tgtArrayBuffer);
    const dist = [],
        distLatent = [],
        distTopo = [],
        distFeature = [];

    function computeDist(i, j, k) {
        let dLat, dTopo, dFeat;
        if (distMatLatent[i].hasOwnProperty(j)) {
            dLat = distMatLatent[i][j];
            dTopo = distMatTopo[i][j];
            dFeat = features ? distMatFeature[i][j] : null;
        } else {
            dLat = getCosineDistance(emb[i], emb[j]);
            dTopo = getNeighborDistance(neighborMasks[i], neighborMasks[j], state.distMetric);
            dFeat =
                !features || nodeTypeIds[i] !== nodeTypeIds[j]
                    ? 0
                    : state.featureScale(getEuclideanDistance(features[i], features[j]));
            distMatLatent[i][j] = dLat;
            distMatLatent[j][i] = dLat;
            distMatTopo[i][j] = dTopo;
            distMatTopo[j][i] = dTopo;
            if (features) {
                distMatFeature[i][j] = dFeat;
                distMatFeature[j][i] = dFeat;
            }
        }
        distLatent.push(dLat);
        distTopo.push(dTopo);
        if (features) {
            distFeature.push(dFeat);
            dist.push([dLat, dTopo, dFeat]);
        } else {
            dist.push([dLat, dTopo]);
        }
        srcBuf[k] = i;
        tgtBuf[k] = j;
    }

    let k = 0;
    for (const p of pairGen()) {
        computeDist(p[0], p[1], k);
        k++;
    }
    console.log("Binning distances...");

    const binGen1d = d3bin().domain([0, 1]).thresholds(state.numBins);
    const binsLatent = binGen1d(distLatent),
        binsTopo = binGen1d(distTopo);
    const gridsTopo = rectBinning(dist, [0, 1], [1, 1], state.numBins);
    let binsFeature = null,
        gridsFeature = null;
    if (features) {
        binsFeature = binGen1d(distFeature);
        gridsFeature = rectBinning(dist, [0, 2], [1, 1], state.numBins);
    }

    const endTime = new Date();
    console.log(
        "Finish computing distances.  total time: ",
        (endTime.getTime() - startTime.getTime()) / 1000,
        "s"
    );
    return Comlink.transfer(
        {
            src: srcBuf,
            tgt: tgtBuf,
            binsLatent,
            binsTopo,
            binsFeature,
            gridsTopo,
            gridsFeature,
        },
        [srcBuf.buffer, tgtBuf.buffer]
    );
}

Comlink.expose({
    initializeState: initializeState,
    computeDistances: computeDistances,
});
