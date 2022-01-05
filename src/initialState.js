import { bin as d3bin } from "d3";

export default {
    loaded: false,
    datasetId: null,
    datasetName: null,
    // homePath: "",
    // homePath: '/~zipeng/private/corgie-prototype',

    numNodeClasses: false,
    hasLinkPredictions: false,

    centralNodeType: 0,
    nodeColors: [],

    featureAgg: {
        active: false,
        hovered: null,
        highlighted: null,
        display: [],
    },
    nodeAttrs: {
        active: false,
        hovered: null,
        highlighted: null,
        display: [],
    },

    selectedNodes: [], // Array of array
    isNodeSelected: {}, // Dict for ALL selected nodes
    isNodeSelectedNeighbor: {},

    highlightedNodes: [],
    highlightedNodePairs: [],
    highlightedEdges: [], // list of edges between highlighted nodes

    hoveredNodes: [], // either one or two nodes (when hovering on an edge)
    hoveredNodesAndNeighbors: [], // neighbors of hovered nodes + hovered nodes
    hoveredEdges: [], // list of edges between hovered nodes and their neighbors

    neighborIntersections: null,

    distances: {
        maxSample: 1000000,
        featureScale: null,
        displaySpecial: [],
        display: [
            { isComputing: true, title: "all (down-sampled)" },
            { isComputing: true, title: "connected by edges" },
        ],
    },

    initialLayout: {
        running: true,
    },
    focalLayout: {
        running: false,
    },

    // Form data for the create scatterplot modal
    scatterplotForm: {
        show: false,
        connectivity: "edge", // Possible values: all, edge, nonedge
        userInterests: "all", // Possible values: all, highlight, foc-i, foc-i*foc-j
        linkPrediction: "all", // possible values: all, pred-true, pred-false
        nodePairs: [],
    },

    param: {
        hops: 2,
        hopsHover: 1,
        hopsHighlight: 0,

        colorBy: "umap", // Could be "umap" (for emb 2d postion), "pred-labels", "true-labels", "correctness", or a name of the attribute
        colorScale: null,

        // neighborDistanceMetric: 'hamming',
        neighborDistanceMetric: "jaccard",

        nodeSize: 4,

        // Only highlight nodes of type / label
        highlightNodeType: "all", // "all" or integer for a specific node type
        highlightNodeLabel: "all", // "all", "correct", "wrong", "pred-${k}", "true-${k}" where k is the label ID

        hideHighlightView: false,

        graph: {
            layout: "force-directed-d3",
            // layout: "random",
            bounded: false,
        },

        focalGraph: {
            // layout: 'force-directed-d3',
            layout: "umap",
            // layout: 'spiral',
            // layout: 'group-constraint-cola',
            showSettings: false,
            useEdgeBundling: true,
            useGlobalMask: true,
        },

        embeddings: {
            maxWindow: false,
            showEdges: false,
        },
        neighborLatentMap: {
            isOpen: true,
            hop: 1,
            useLinearScale: false,
            showSettings: false,
        },

        features: {
            collapsed: [false],
        },

        // Highlight nodes with the following filter in the node attributes
        // Either use node attributes or search by labels, one or the other, not the same time.
        nodeFilter: {
            whichAttr: null,
            whichRow: null,
            brushedArea: null,
            searchLabel: null,
            searchId: null,
            searchShown: false,
        },

        nodePairFilter: {
            // ascending: true, // sort the node pairs by latent distance in ascending order
            isTopoVsLatent: null,
            which: null,
            brushedArea: null,
            useLinearScale: false,
        },
        unseenTopK: 5,

        activeDistanceTab: "topo-vs-latent",
    },

    spec: {
        graph: {
            paddingTop: 18, // Padding of focal graph to fit in the group label
            paddingBottom: 2,
            padding: 10, // padding within group
            gapBetweenHop: 10,
            gapBetweenFocal: 16,

            edgeType: "line",
            neighborMarkerMaxHeight: 30,
            innerRingNodeGap: 10,
            outerRingNodeGap: 2,
            minRingGap: 50, // Minimum gap between the two rings (along the radius axis)
        },
        latent: {
            width: 380,
            height: 380,
            paddings: { top: 18, bottom: 4, left: 6, right: 6 },
            widthMax: 800,
            heightMax: 800,
            paddingsMax: { top: 20, bottom: 10, left: 10, right: 10 },
        },
        neighborLatentMap: {
            cellSize: 6,
            gap: 1, // Gap between blocks
        },
        intersectionPlot: {
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            topLabelHeight: 30,
            dotSize: 10,
            dotMargin: 10,
            verticalMargin: 5,
            cardScaleRange: 50,
            plotHorizontalMargin: 30,
        },
        adjacencyMatrix: {
            margins: { top: 10, bottom: 10, left: 10, right: 80 },
            rowHeight: 14,
            colWidth: 14,
            gap: 6,
            histogramAreaHeight: 120,
            histogramHeight: 100,
            labelHeight: 10,

            labelAreaSize: 100,
            labelSize: 10, // Must be <= rowHeight and colWidth
            countAreaSize: 20,
            countBarHeight: 100,
        },
        histogram: {
            margins: { top: 10, bottom: 18, left: 30, right: 10 },
            height: 50,
            width: 100,
        },
        partialHistogram: {
            margins: { top: 10, bottom: 18, left: 30, right: 10 },
            height: 30,
            width: 100,
        },
        scatterHist: {
            margins: { top: 15, bottom: 12, left: 18, right: 20 },
            histHeight: 15,
            histWidth: 20,
            scatterHeight: 80,
            scatterWidth: 80,
            tickLabelGap: 15,
            dotSize: 2,
            numBins: 20,
            legendWidth: 20,
            gridBinSize: 0.05,
        },
        feature: {
            cellSize: 6,
            cellGap: 1,
            margins: { top: 8, bottom: 8, left: 10, right: 10 },
            stripMaxWidth: 1000,
            stripWidth: 2,
            maxNumStrips: 500, // remember to sync these three values
            stripHeight: 15,
        },
    },
};
