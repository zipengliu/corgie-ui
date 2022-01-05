import * as Comlink from "comlink";
import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    scaleSqrt,
    scaleLog,
    scaleLinear,
    extent,
} from "d3";

function computeForceLayoutWithD3(numNodes, edges, padding, bounded) {
    // const constrainCoord = (v, min, max) => Math.max(min, Math.min(v, max));
    console.log("Computing initial D3 force layout...", new Date());
    let coords = new Array(numNodes).fill(false).map((_, i) => ({ index: i }));

    const maxNumNodes = 10000;
    const getSize = scaleSqrt().domain([1, maxNumNodes]).range([500, 1000]).clamp(true),
        getLinkDistance = scaleLog().base(2).domain([1, maxNumNodes]).range([100, 1.5]).clamp(true),
        getRepelStrength = scaleLog().base(2).domain([1, maxNumNodes]).range([-100, -1.5]).clamp(true);
    const canvasSize = getSize(numNodes),
        linkDist = getLinkDistance(numNodes),
        repelStrength = getRepelStrength(numNodes);

    console.log("D3 parameters: ", { canvasSize, linkDist, repelStrength, padding });

    let simulation = forceSimulation(coords)
        .force("link", forceLink(edges).distance(linkDist))
        .force("charge", forceManyBody().strength(repelStrength).distanceMin(0.2).distanceMax(100))
        .force("center", forceCenter(canvasSize / 2, canvasSize / 2))
        .stop();

    const numIterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    if (bounded) {
        for (let i = 0; i < numIterations; i++) {
            // Constrain the nodes in a bounding box
            for (let c of coords) {
                c.x = Math.max(padding, Math.min(canvasSize - padding, c.x));
                c.y = Math.max(padding, Math.min(canvasSize - padding, c.y));
            }
            simulation.tick();
        }
    } else {
        simulation.tick(numIterations);
    }

    const xExtent = extent(coords.map((c) => c.x)),
        yExtent = extent(coords.map((c) => c.y));
    const xRange = xExtent[1] - xExtent[0],
        yRange = yExtent[1] - yExtent[0];
    let xScale = (x) => x,
        yScale = (y) => y;
    let width = canvasSize,
        height = canvasSize;
    if (!bounded || xRange + 2 * padding < canvasSize * 0.95) {
        xScale = scaleLinear()
            .domain(xExtent)
            .range([padding, xRange + padding]);
        width = xRange + 2 * padding;
    }
    if (!bounded || yRange + 2 * padding < canvasSize * 0.95) {
        yScale = scaleLinear()
            .domain(yExtent)
            .range([padding, yRange + padding]);
        height = yRange + 2 * padding;
    }
    console.log("Finish computing initial D3 force layout...", new Date());
    return {
        coords: coords.map((c) => ({ x: xScale(c.x), y: yScale(c.y) })),
        width,
        height,
        name: "D3 force-directed",
    };
}

Comlink.expose({
    computeForceLayoutWithD3: computeForceLayoutWithD3,
});
