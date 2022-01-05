import "whatwg-fetch";
import React, { Component } from "react";
import { Button, Container, Row, Col, Table, Alert, Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import AppNav from "./AppNav";

function humanFileSize(size) {
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + " " + ["B", "kB", "MB", "GB", "TB"][i];
}

const CORGIE_URL = "http://localhost:3000";
const UPLOAD_URL = "http://localhost:8787/upload";
const STATUS_URL = "http://localhost:8787/status";
const required = {
    name: "dataset name",
    hops: "#hops",
    graph: "input graph file",
    embedding: "node embedding file",
};

function UploadModal({ datasetId, done }) {
    return (
        <Modal show backdrop="static" size="lg" aria-labelledby="contained-modal-title-vcenter" centered>
            <Modal.Header closeButton>
                <Modal.Title id="contained-modal-title-vcenter">
                    {done ? "Success" : "In progress"}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div>
                    <p>Dataset ID: {datasetId}.</p>
                    <p>Dataset URL: {CORGIE_URL + "/" + datasetId}</p>
                    <p>This ID (or URL) is the only access to your dataset. Please save it.</p>
                    {done && (
                        <Button variant="primary">
                            <Link to={`/${datasetId}`}>Go</Link>
                        </Button>
                    )}
                </div>
            </Modal.Body>
        </Modal>
    );
}

export default class Upload extends Component {
    constructor(props) {
        super(props);
        this.state = {
            datasetId: null,
            uploading: false,
            status: null,
            missingRequired: null,

            form: {
                name: null,
                hops: null,
                graph: null,
                features: null,
                featureMeta: null,
                embedding: null,
                umap: null,
                predRes: null,
            },
        };

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleFileChange = this.handleFileChange.bind(this);
    }

    handleChange(event) {
        this.setState((prevState) => ({
            form: { ...prevState.form, [event.target.name]: event.target.value },
        }));
    }
    handleFileChange(event) {
        this.setState((prevState) => ({
            form: { ...prevState.form, [event.target.name]: event.target.files[0] },
        }));
    }

    missingRequired() {
        for (let x in required)
            if (required.hasOwnProperty(x)) {
                if (!this.state.form.hasOwnProperty(x) || this.state.form[x] === null) {
                    return required[x];
                }
            }
        return false;
    }
    handleSubmit(event) {
        // Upload the data to server
        console.log("submit");
        console.log(this.state);

        const missing = this.missingRequired();
        if (missing) {
            this.setState({ missingRequired: missing });
        } else {
            this.setState({ uploading: true, missingRequired: null, status: 0 });

            const stateForm = this.state.form;
            const f = new FormData();
            for (let x in stateForm)
                if (stateForm.hasOwnProperty(x) && stateForm[x] !== null) {
                    f.append(x, stateForm[x]);
                }

            fetch(UPLOAD_URL, {
                method: "POST",
                mode: "cors",
                body: f,
            })
                .then((response) => response.text())
                .then((datasetId) => {
                    console.log("File transfer succeeded.  Dastaset ID: ", datasetId);
                    this.setState({ datasetId });

                    let that = this;
                    const polling = setInterval(() => {
                        fetch(STATUS_URL + "?" + new URLSearchParams({ id: datasetId }))
                            .then((r) => r.text())
                            .then((s) => {
                                if (s === "1") {
                                    clearInterval(polling);
                                    that.setState({ status: 1 });
                                }
                            })
                            .catch(() => {
                                console.error("Check status error!");
                            });
                    }, 500);
                })
                .catch(() => {
                    console.error("Post data error!");
                });
        }
        event.preventDefault();
    }

    fileInputComp(name) {
        return (
            <div>
                <input type="file" name={name} onChange={this.handleFileChange} />
                {this.state.form[name] && <div>{humanFileSize(this.state.form[name].size)}</div>}
            </div>
        );
    }

    render() {
        return (
            <div>
                <AppNav />
                <Container>
                    <Row>
                        <Col>
                            <h3 style={{ marginTop: "10px" }}>Upload your own datasets</h3>
                            <div>
                                You can upload the input and output of a GNN training session to CorGIE. Once
                                the preprocessing is finished, you will be provided with a{" "}
                                <strong>dataset ID</strong>, which is the <strong>only access token </strong>
                                for this dataset.
                            </div>
                            <div>Note: your datasets are stored on our server unless you remove them.</div>
                        </Col>
                    </Row>

                    <Row>
                        <Col>
                            <h5 style={{ marginTop: "10px" }}>Dataset files</h5>
                        </Col>
                    </Row>

                    <Row>
                        <Col>
                            <div>
                                You can download two sample datasets for reference on the right column below.
                            </div>
                        </Col>
                    </Row>

                    <div style={{ marginTop: "10px" }}></div>

                    <Row>
                        <Col md={2}>
                            <Button variant="primary" onClick={this.handleSubmit}>
                                Submit
                            </Button>
                        </Col>
                        {this.state.missingRequired && (
                            <Col>
                                <Alert variant="danger">
                                    Missing {this.state.missingRequired}. Please fill it in and re-submit.
                                </Alert>
                            </Col>
                        )}
                    </Row>

                    <div style={{ marginTop: "10px" }}></div>

                    <Table bordered hover>
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Required</th>
                                <th style={{ minWidth: "300px" }}>File description</th>
                                <th>Input</th>
                                <th>Sample: movie</th>
                                <th>Sample: Cora</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td></td>
                                <td>
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </td>
                                <td>Dataset name</td>
                                <td>
                                    <input type="text" name="name" onChange={this.handleChange} />
                                </td>
                                <td>bipartite-user-movie-medium-1</td>
                                <td>cora-gat</td>
                            </tr>
                            <tr>
                                <td rowSpan={3}>GNN input</td>
                                <td>
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </td>
                                <td>
                                    Input graph: a{" "}
                                    <strong>
                                        <a href="https://networkx.org/">NetworkX</a> json{" "}
                                    </strong>{" "}
                                    file describing the nodes, link, and optionally, dense node features in
                                    the input graph. See{" "}
                                    <a href="https://networkx.org/documentation/stable/reference/convert.html">
                                        here
                                    </a>{" "}
                                    for format conversion.
                                </td>
                                <td>{this.fileInputComp("graph")}</td>
                                <td>
                                    <Link
                                        to="/data/bipartite-user-movie-medium-1/graph.json"
                                        target="_blank"
                                        download
                                    >
                                        graph.json
                                    </Link>
                                </td>
                                <td>
                                    <Link to="/data/cora-gat/graph.json" target="_blank" download>
                                        graph.json
                                    </Link>
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    Meta data for dense node features: description of each dense node feature
                                    (e.g. budget of a movie) in <strong>json</strong> format.
                                </td>
                                <td>{this.fileInputComp("featureMeta")}</td>
                                <td>
                                    <Link
                                        to="/data/bipartite-user-movie-medium-1/attr-meta.json"
                                        target="_blank"
                                        download
                                    >
                                        feature-meta.json
                                    </Link>
                                </td>
                                <td>NA</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    Sparse node features: node feature vectors (e.g. word frequencies in Cora)
                                    in <strong>csv</strong> format.
                                </td>
                                <td>{this.fileInputComp("features")}</td>
                                <td>NA</td>
                                <td>
                                    <Link to="/data/cora-gat/features.csv" target="_blank" download>
                                        features.csv
                                    </Link>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={6}></td>
                            </tr>
                            <tr>
                                <td>GNN model</td>
                                <td>
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </td>
                                <td># Hops: the number of aggregation layer in your GNN</td>
                                <td>
                                    <input type="text" name="hops" onChange={this.handleChange} />
                                </td>
                                <td>2</td>
                                <td>2</td>
                            </tr>
                            <tr>
                                <td colSpan={6}></td>
                            </tr>

                            <tr>
                                <td rowSpan={3}>GNN output</td>
                                <td>
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </td>
                                <td>
                                    Node embedding: embedding vectors in <strong>csv</strong> format
                                </td>
                                <td>{this.fileInputComp("embedding")}</td>
                                <td>
                                    <Link
                                        to="/data/bipartite-user-movie-medium-1/node-embeddings.csv"
                                        target="_blank"
                                        download
                                    >
                                        embedding.csv
                                    </Link>
                                </td>
                                <td>
                                    <Link to="/data/cora-gat/node-embeddings.csv" target="_blank" download>
                                        embedding.csv
                                    </Link>
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    Node embedding in 2D: dimensionally reduced (e.g. UMAP, t-SNE) embedding
                                    vector in vector in <strong>csv</strong> format. We compute it in the
                                    pre-processor if not provided.
                                </td>
                                <td>{this.fileInputComp("umap")}</td>
                                <td>
                                    <Link
                                        to="/data/bipartite-user-movie-medium-1/umap.csv"
                                        target="_blank"
                                        download
                                    >
                                        emb2d.csv
                                    </Link>
                                </td>
                                <td>
                                    <Link to="/data/cora-gat/umap.csv" target="_blank" download>
                                        emb2d.csv
                                    </Link>
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    Prediction results in <strong>json</strong> format.
                                    <div>
                                        For node classification task: predicted and true class of each node.
                                        <div>
                                            <small>
                                                &#123; predLabels: [], trueLabels: [], numClasses: x &#125;
                                            </small>
                                        </div>
                                    </div>
                                    <div>
                                        For link prediction task: presented edges that are predicted as true
                                        by the model (true allow edges), presented edges that are presented as
                                        false by the model (false allow edges), and recommended edges that are
                                        not presented in the input graph (true unseen edges), sorted by a
                                        recommendation score.
                                        <div>
                                            <small>
                                                &#123; isLinkPrediction: true, trueAllowEdges: [node pair
                                                array], falseAllowEdges: [node pair array]
                                                trueUnseenEdgesSorted: &#123; node id x: [node list sorted by
                                                their similarty score with x] &#125; &#125;
                                            </small>
                                        </div>
                                    </div>
                                </td>
                                <td>{this.fileInputComp("predRes")}</td>
                                <td>
                                    <Link
                                        to="/data/bipartite-user-movie-medium-1/prediction-results.json"
                                        target="_blank"
                                        download
                                    >
                                        pred-res.json
                                    </Link>
                                </td>
                                <td>
                                    <Link
                                        to="/data/cora-gat/prediction-results.json"
                                        target="_blank"
                                        download
                                    >
                                        pred-res.json
                                    </Link>
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </Container>
                {this.state.uploading && this.state.datasetId && (
                    <UploadModal datasetId={this.state.datasetId} done={this.state.status === 1} />
                )}
            </div>
        );
    }
}
