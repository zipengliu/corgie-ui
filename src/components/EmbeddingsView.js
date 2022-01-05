import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpandAlt, faCompressAlt } from "@fortawesome/free-solid-svg-icons";
import GraphLayout from "./GraphLayout";
import SettingsView from "./SettingsView";
import { changeParam } from "../actions";

class EmbeddingsView extends Component {
    renderForm() {
        const { showEdges, changeParam } = this.props;
        return (
            <Form inline>
                <Form.Group>
                    <Form.Label>Show graph edges: </Form.Label>

                    <Form.Check
                        style={{ marginLeft: "5px" }}
                        type="radio"
                        id="emb-show-edge-none"
                        checked={!showEdges}
                        onChange={changeParam.bind(null, "embeddings.showEdges", false, null, null)}
                        label="None"
                    />
                    <Form.Check
                        style={{ marginLeft: "5px" }}
                        type="radio"
                        id="emb-show-edge-bundle"
                        checked={showEdges === "bundled"}
                        onChange={changeParam.bind(null, "embeddings.showEdges", "bundled", null, null)}
                        label="bundled"
                    />
                    <Form.Check
                        style={{ marginLeft: "5px" }}
                        type="radio"
                        id="emb-show-edge-straight"
                        checked={showEdges === "straight"}
                        onChange={changeParam.bind(null, "embeddings.showEdges", "straight", null, null)}
                        label="straight"
                    />
                </Form.Group>
            </Form>
        );
    }
    render() {
        const { numDim, layouts, showEdges, maxWindow, changeParam } = this.props;

        if (maxWindow) {
            return (
                <Modal
                    show={true}
                    centered
                    id="embeddings-view"
                    onHide={changeParam.bind(null, "embeddings.maxWindow", false, null, null)}
                >
                    <Modal.Header closeButton>
                        <Modal.Title>
                            Latent space <small>(UMAP, #dim={numDim})</small>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <GraphLayout
                            layoutData={layouts.layoutMax}
                            useStrokeForFocal={true}
                            fromView="emb"
                            showEdges={showEdges}
                        />
                        {this.renderForm()}
                        <SettingsView />
                    </Modal.Body>
                    {/* <Modal.Footer>Click or brush to highlight nodes without neighbors.</Modal.Footer> */}
                </Modal>
            );
        }
        return (
            <div id="embeddings-view" className="view">
                <h5 className="view-title text-center">
                    <span
                        className="left-btn"
                        onClick={changeParam.bind(null, "embeddings.maxWindow", true, null, null)}
                    >
                        <FontAwesomeIcon icon={faExpandAlt} />
                    </span>
                    Latent Space <small>(UMAP, #dim={numDim})</small>
                </h5>

                <div className="view-body">
                    <GraphLayout
                        layoutData={maxWindow ? layouts.layoutMax : layouts.layoutMin}
                        useStrokeForFocal={true}
                        fromView="emb"
                        showEdges={showEdges}
                    />
                    {this.renderForm()}
                </div>

                {/* <div className="view-footer">Click or brush to highlight nodes without neighbors.</div> */}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    const { maxWindow } = state.param.embeddings;
    return {
        numDim: emb ? emb[0].length : null,
        showEdges: state.param.embeddings.showEdges,
        maxWindow,
        layouts: state.latent,
    };
};

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
