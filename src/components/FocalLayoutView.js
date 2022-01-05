import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Spinner, Form, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWrench } from "@fortawesome/free-solid-svg-icons";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import GraphLayout from "./GraphLayout";
import { ComputingSpinner } from "./InitialLayoutView";
import { changeFocalParam } from "../actions";

const SettingModal = ({ params, changeFocalParam, hops }) => (
    <Modal
        show={params.showSettings}
        centered
        id="focal-layout-settings-modal"
        onHide={changeFocalParam.bind(null, "focalGraph.showSettings", false)}
    >
        <Modal.Header closeButton>
            <Modal.Title>Settings for focal graph layout</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form>
                <Form.Group>
                    <Form.Check
                        custom
                        type="radio"
                        id="use-edge-bundling-1"
                        checked={params.useEdgeBundling}
                        onChange={changeFocalParam.bind(null, "focalGraph.useEdgeBundling", true)}
                        label="edge bundling (curved edges)"
                    />
                    <Form.Check
                        custom
                        type="radio"
                        id="use-edge-bundling-2"
                        checked={!params.useEdgeBundling}
                        onChange={changeFocalParam.bind(null, "focalGraph.useEdgeBundling", false)}
                        label="straight edges"
                    />
                </Form.Group>
                {hops > 1 && (
                    <Form.Group>
                        <Form.Check
                            custom
                            type="radio"
                            id="use-global-mask-1"
                            checked={params.useGlobalMask}
                            onChange={changeFocalParam.bind(null, "focalGraph.useGlobalMask", true)}
                            label={`use ${hops} hops to compute distance (as in GNN trainning)`}
                        />
                        <Form.Check
                            custom
                            type="radio"
                            id="use-global-mask-2"
                            checked={!params.useGlobalMask}
                            onChange={changeFocalParam.bind(null, "focalGraph.useGlobalMask", false)}
                            label="use 1 hop only"
                        />
                    </Form.Group>
                )}
            </Form>
        </Modal.Body>
    </Modal>
);

function FocalLayoutView({ focalLayout, hasFocalNodes, hops, params, changeFocalParam, focalAlg }) {
    return (
        <div className={`view ${hasFocalNodes ? "" : "no-layout"}`} id="focal-graph-view">
            <h5 className="view-title text-center">
                K-hop Topology
                <span style={{ marginLeft: "5px", cursor: "pointer" }}>
                    <OverlayTrigger
                        placement="right"
                        overlay={
                            <Tooltip id="distance-view-tooltip">
                                Nodes of each group are layout using UMAP independently with the topological
                                distance metric (Jaccard Index). Nodes outside {hops} hops are not shown.
                            </Tooltip>
                        }
                    >
                        <FontAwesomeIcon icon={faQuestionCircle} />
                    </OverlayTrigger>
                </span>
                <span
                    className="right-btn"
                    onClick={changeFocalParam.bind(null, "focalGraph.showSettings", true)}
                >
                    <FontAwesomeIcon icon={faWrench} />
                </span>
            </h5>
            <div className="view-body">
                {!hasFocalNodes && (
                    <div>
                        No focal groups yet. Try highlight nodes (by brushing / clicking) and then create
                        focal groups.
                    </div>
                )}
                {hasFocalNodes && (
                    <div>
                        {focalLayout.running ? (
                            <ComputingSpinner />
                        ) : (
                            <GraphLayout
                                layoutData={focalLayout}
                                useStrokeForFocal={false}
                                fromView="graph-layout"
                                showEdges={params.useEdgeBundling ? "bundled" : true}
                            />
                        )}
                        {!!focalLayout.runningMsg && (
                            <div style={{ margin: "10px" }}>
                                <Spinner animation="border" role="status" size="sm" />
                                <span style={{ marginLeft: "10px" }}>{focalLayout.runningMsg}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {hasFocalNodes && (
                <div className="view-footer">
                    #nodes: {focalLayout.numNodes}, #edges: {focalLayout.numEdges} 
                    {/* , Layout algorithm:{" "} {focalLayout.name} */}
                </div>
            )}

            <SettingModal params={params} changeFocalParam={changeFocalParam} hops={hops} />
        </div>
    );
}

const mapStateToProps = (state) => ({
    hasFocalNodes: state.selectedNodes.length > 0,
    hops: state.param.hops,
    focalAlg: state.param.focalGraph.layout,
    params: state.param.focalGraph,
    focalLayout: state.focalLayout,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeFocalParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(FocalLayoutView);
