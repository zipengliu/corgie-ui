import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Modal, Button, Col, Tabs, Tab, Nav, OverlayTrigger, Tooltip } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { faWrench } from "@fortawesome/free-solid-svg-icons";
import { format } from "d3";
import { getNeighborDistance, getCosineDistance, getEuclideanDistance } from "../utils";
import {
    highlightNodePairs,
    hoverNode,
    changeParam,
    changeScatterplotForm,
    addDistanceScatterplot,
} from "../actions";
import { ComputingSpinner } from "./InitialLayoutView";
import ScatterHistogram from "./ScatterHistogram";
import NodePairList from "./NodePairList";

export class DistanceView extends Component {
    renderCreateModal() {
        const { highlightedNodes, hasLinkPredictions, selectedNodes, formData } = this.props;
        const { useLinearScale } = this.props.nodePairFilter;
        const { show, connectivity, userInterests, linkPrediction, nodePairs } = formData;
        const { changeScatterplotForm, changeParam } = this.props;
        const numFoc = selectedNodes.length;
        const btwFoc = [];
        for (let i = 0; i < numFoc; i++) {
            for (let j = i + 1; j < numFoc; j++) {
                btwFoc.push([i, j]);
            }
        }

        return (
            <Modal
                show={show}
                size="lg"
                centered
                id="create-scatterplot-modal"
                onHide={this.props.changeScatterplotForm.bind(null, "show", false)}
            >
                <Modal.Header closeButton>
                    <Modal.Title>Customization</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <h6>Settings</h6>
                    <Form inline>
                        <Form.Label style={{ marginRight: "5px" }}>Choose scale type:</Form.Label>
                        <Form.Check
                            inline
                            label="linear"
                            type="radio"
                            id="scale-linear-ctrl"
                            checked={useLinearScale}
                            onChange={() => {
                                changeParam("nodePairFilter.useLinearScale", null, true);
                            }}
                        />
                        <Form.Check
                            inline
                            label="log10"
                            type="radio"
                            id="scale-log-ctrl"
                            checked={!useLinearScale}
                            onChange={() => {
                                changeParam("nodePairFilter.useLinearScale", null, true);
                            }}
                        />
                    </Form>

                    <h6 style={{ marginTop: "30px" }}>Create customized node-pair scatterplot</h6>
                    <Form>
                        <Form.Row>
                            <Form.Label column sm={2}>
                                Connectivity
                            </Form.Label>
                            <Col>
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="all"
                                    checked={connectivity === "all"}
                                    onChange={changeScatterplotForm.bind(null, "connectivity", "all")}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="connected by an edge"
                                    checked={connectivity === "edge"}
                                    onChange={changeScatterplotForm.bind(null, "connectivity", "edge")}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="not connected"
                                    checked={connectivity === "nonedge"}
                                    onChange={changeScatterplotForm.bind(null, "connectivity", "nonedge")}
                                />
                            </Col>
                        </Form.Row>

                        <div style={{ marginBottom: "20px" }}></div>

                        <Form.Row>
                            <Form.Label column sm={2}>
                                User interests
                            </Form.Label>
                            <Col>
                                {(highlightedNodes.length > 1 || selectedNodes.length > 0) && (
                                    <Form.Row>
                                        <Col>
                                            <Form.Check
                                                type="radio"
                                                label="all"
                                                checked={userInterests === "all"}
                                                onChange={changeScatterplotForm.bind(
                                                    null,
                                                    "userInterests",
                                                    "all"
                                                )}
                                            />
                                        </Col>
                                    </Form.Row>
                                )}
                                {highlightedNodes.length > 1 && (
                                    <Form.Row>
                                        <Col>
                                            <Form.Check
                                                type="radio"
                                                label="within highlighted nodes"
                                                checked={userInterests === "highlight"}
                                                onChange={changeScatterplotForm.bind(
                                                    null,
                                                    "userInterests",
                                                    "highlight"
                                                )}
                                            />
                                        </Col>
                                    </Form.Row>
                                )}
                                {selectedNodes.length > 0 && (
                                    <Form.Row>
                                        {selectedNodes.map((s, i) => (
                                            <Col key={i}>
                                                <Form.Check
                                                    type="radio"
                                                    label={`within foc-${i}`}
                                                    checked={userInterests === `foc-${i}`}
                                                    onChange={changeScatterplotForm.bind(
                                                        null,
                                                        "userInterests",
                                                        `foc-${i}`
                                                    )}
                                                />
                                            </Col>
                                        ))}
                                    </Form.Row>
                                )}
                                {btwFoc.length > 0 && (
                                    <Form.Row>
                                        {btwFoc.map((g, i) => (
                                            <Col key={i} md={4}>
                                                <Form.Check
                                                    type="radio"
                                                    label={`between foc-${g[0]} & foc-${g[1]}`}
                                                    checked={userInterests === `foc-${g[0]}*foc-${g[1]}`}
                                                    onChange={changeScatterplotForm.bind(
                                                        null,
                                                        "userInterests",
                                                        `foc-${g[0]}*foc-${g[1]}`
                                                    )}
                                                />
                                            </Col>
                                        ))}
                                    </Form.Row>
                                )}
                                {highlightedNodes.length < 2 && !selectedNodes.length && (
                                    <Form.Text>
                                        Not applicable. Please specify interests by highlighting or focusing
                                        nodes.
                                    </Form.Text>
                                )}
                            </Col>
                        </Form.Row>

                        <div style={{ marginBottom: "20px" }}></div>
                        <Form.Row>
                            <Form.Label column sm={2}>
                                Link prediction
                            </Form.Label>
                            {hasLinkPredictions ? (
                                <Col>
                                    <Form.Check
                                        inline
                                        type="radio"
                                        label="all"
                                        checked={linkPrediction === "all"}
                                        onChange={changeScatterplotForm.bind(null, "linkPrediction", "all")}
                                    />
                                    <Form.Check
                                        inline
                                        type="radio"
                                        label="predicted true"
                                        checked={linkPrediction === "pred-true"}
                                        onChange={changeScatterplotForm.bind(
                                            null,
                                            "linkPrediction",
                                            "pred-true"
                                        )}
                                    />
                                    <Form.Check
                                        inline
                                        type="radio"
                                        label="predicted false"
                                        checked={linkPrediction === "pred-false"}
                                        onChange={changeScatterplotForm.bind(
                                            null,
                                            "linkPrediction",
                                            "pred-false"
                                        )}
                                    />

                                    <Form.Text>
                                        Note that prediction only applies to node pairs with specific node
                                        types in k-partitie graph.
                                    </Form.Text>
                                </Col>
                            ) : (
                                <Col>
                                    <Form.Text>Not applicable. No link prediction results loaded.</Form.Text>
                                </Col>
                            )}
                        </Form.Row>

                        <div style={{ marginBottom: "20px" }}></div>

                        <div style={{ marginBottom: "10px" }}>
                            Number of filtered node pairs: {nodePairs.length}
                        </div>
                        <Button
                            // type="submit"
                            onClick={this.props.addDistanceScatterplot}
                            disabled={!nodePairs.length}
                        >
                            Create
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        );
    }

    render() {
        const {
            hops,
            distances,
            nodePairFilter,
            spec,
            highlightDistVals,
            hasFeatures,
            activeTab,
        } = this.props;
        const { highlightedNodePairs } = this.props;
        const { highlightNodePairs, changeParam } = this.props;
        const { display, displaySpecial } = distances;
        const { useLinearScale } = nodePairFilter;
        const numFormat = format(".2~s");

        const getScatterHistList = (isTopoVsLatent) => (
            <div className="scatter-hist-list">
                {displaySpecial.concat(display).map((d, i) => (
                    <div className="stuff-container" key={i}>
                        <div className="container-title">
                            {d.title} (#={d.src ? numFormat(d.src.length) : ""})
                        </div>
                        <div className="container-body">
                            {d.isComputing ? (
                                <ComputingSpinner />
                            ) : (
                                <ScatterHistogram
                                    data={d}
                                    isTopoVsLatent={isTopoVsLatent}
                                    hasHist={true}
                                    useLinearScale={useLinearScale}
                                    spec={spec}
                                    xLabel="latent"
                                    yLabel={isTopoVsLatent ? "topo" : "feature"}
                                    hVals={highlightDistVals}
                                    brushedFunc={highlightNodePairs.bind(null, isTopoVsLatent, i)}
                                    brushedArea={
                                        isTopoVsLatent === nodePairFilter.isTopoVsLatent &&
                                        nodePairFilter.which === i
                                            ? nodePairFilter.brushedArea
                                            : null
                                    }
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );

        return (
            <div
                className="view"
                id="distance-view"
                style={{
                    width:
                        displaySpecial.length + display.length > 2 || highlightedNodePairs.length > 0
                            ? 580 
                            : 420,
                }}
            >
                <h5 className="view-title text-center">
                    {/* Distances in latent, topology, and feature spaces */}
                    Distance Comparison
                    <span style={{ marginLeft: "5px", cursor: "pointer" }}>
                        <OverlayTrigger
                            placement="right"
                            overlay={
                                <Tooltip id="distance-view-tooltip">
                                    Topological distance of node pair = 1.0 - Jaccard Index of {hops}-hop
                                    neighbor sets of two nodes. <br />
                                    Latent distance of node pair = cosine distance of node embeddings. <br />
                                    {hasFeatures && (
                                        <div>
                                            Feature distance = euclidean distance (scaled to [0,1]) of
                                            (normalized) node feature vectors
                                        </div>
                                    )}
                                    Luminance ~ #node pairs with specific distance values.
                                </Tooltip>
                            }
                        >
                            <FontAwesomeIcon icon={faQuestionCircle} />
                        </OverlayTrigger>
                    </span>
                    <span
                        className="right-btn"
                        onClick={this.props.changeScatterplotForm.bind(null, "show", true)}
                    >
                        <FontAwesomeIcon icon={faWrench} />
                    </span>
                </h5>
                <div className="view-body">
                    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-around" }}>
                        <div>
                            {hasFeatures && (
                                <Nav
                                    variant="pills"
                                    activeKey={activeTab}
                                    onSelect={(k) => {
                                        changeParam("activeDistanceTab", k);
                                    }}
                                >
                                    <Nav.Item>
                                        <Nav.Link eventKey="topo-vs-latent">Topo vs. latent</Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="feature-vs-latent">Feature vs. latent</Nav.Link>
                                    </Nav.Item>
                                </Nav>
                            )}

                            {getScatterHistList(activeTab === "topo-vs-latent")}
                        </div>
                        {highlightedNodePairs.length > 0 && <NodePairList />}
                    </div>
                </div>

                {this.renderCreateModal()}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    const { neighborMasks, sparseFeatures, denseFeatures, nodes } = state.graph;
    const { hoveredNodes, selectedNodes } = state;
    const f = sparseFeatures || denseFeatures || null;

    let highlightDistVals = null,
        hx = null,
        hy;
    if (!state.distances.display[0].isComputing) {
        if (!!hoveredNodes && hoveredNodes.length === 2) {
            hx = hoveredNodes[0];
            hy = hoveredNodes[1];
        } else if (
            selectedNodes.length === 2 &&
            selectedNodes[0].length === 1 &&
            selectedNodes[1].length === 1
        ) {
            hx = selectedNodes[0][0];
            hy = selectedNodes[1][0];
        }
        if (hx !== null) {
            highlightDistVals = [
                getCosineDistance(emb[hx], emb[hy]),
                getNeighborDistance(neighborMasks[hx], neighborMasks[hy], state.param.neighborDistanceMetric),
                f && nodes[hx].typeId === nodes[hy].typeId
                    ? state.distances.featureScale(getEuclideanDistance(f[hx], f[hy]))
                    : null,
            ];
        }
    }
    return {
        nodeTypes: state.graph.nodeTypes,
        selectedNodes,
        highlightedNodePairs: state.highlightedNodePairs,
        highlightedNodes: state.highlightedNodes,
        hasLinkPredictions: state.hasLinkPredictions,
        highlightDistVals,
        distances: state.distances,
        spec: state.spec.scatterHist,
        nodePairFilter: state.param.nodePairFilter,
        hops: state.param.hops,
        activeTab: state.param.activeDistanceTab,
        formData: state.scatterplotForm,
        hasFeatures: !!f,
    };
};

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodePairs,
            hoverNode,
            changeParam,
            changeScatterplotForm,
            addDistanceScatterplot,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(DistanceView);
