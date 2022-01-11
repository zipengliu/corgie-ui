import "whatwg-fetch";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Navbar, Nav, OverlayTrigger, Tooltip, Button, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { SERVER_URL } from "../initialState";

const isUserDataset = (id) => {
    if (!id || id.length !== 12 + 1 + 4) return false;
    const s = id.split("-");
    if (s.length !== 2 || s[0].length !== 12 || s[1].length !== 4) return false;
    return true;
};

export default class AppNav extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isUser: isUserDataset(this.props.datasetId),
            showModal: false,
            isRemoving: false,
            removeError: null,
            removeSuccess: false,
        };

        this.handleDelete = this.handleDelete.bind(this);
        this.toggleModal = this.toggleModal.bind(this);
    }
    renderModal() {
        const { isRemoving, removeError, removeSuccess } = this.state;
        return (
            <Modal show backdrop="static" size="md" aria-labelledby="contained-modal-title-vcenter">
                <Modal.Header>
                    <Modal.Title id="contained-modal-title-vcenter">
                        Remove current dataset (ID: {this.props.datasetId})
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {isRemoving && !removeError && !removeSuccess ? (
                        <div>Processing...</div>
                    ) : removeError ? (
                        <div>
                            <div>{removeError}</div>
                            <div>Please contact the author to fix it.</div>
                        </div>
                    ) : removeSuccess ? (
                        <div>
                            <div>Your dataset has been removed from the server.</div>
                            <div>
                                <Button variant="primary">
                                    <Link to="/">index page</Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div>Are you sure? This is a irreversible action.</div>
                    )}
                </Modal.Body>
                {!isRemoving && !removeError && !removeSuccess && (
                    <Modal.Footer>
                        <Button onClick={this.toggleModal}>No</Button>
                        <Button variant="primary" onClick={this.handleDelete}>
                            Yes
                        </Button>
                    </Modal.Footer>
                )}
                {removeError && (
                    <Modal.Footer>
                        <Button onClick={this.toggleModal}>Close</Button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
    toggleModal() {
        this.setState((prevState) => ({ showModal: !prevState.showModal }));
    }
    handleDelete() {
        // fetch("http://localhost:8787" + "/remove", {
        fetch(SERVER_URL + "/remove", {
            method: "POST",
            body: JSON.stringify({ id: this.props.datasetId }),
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((r) => {
                if (r.ok) {
                    console.log(r.ok);
                    return r.text();
                } else {
                    throw new Error("The request to remove dataset has failed");
                }
            })
            .then((r) => {
                if (r == 0) {
                    console.error("");
                    this.setState({
                        isRemoving: false,
                        removeError: "Remove dataset failed: non-existing dataset ID",
                    });
                } else {
                    // Tell user the dataset had been removed and then jump to index
                    this.setState({
                        isRemoving: false,
                        removeError: null,
                        removeSuccess: 1,
                    });
                }
            })
            .catch((err) => {
                console.error(err);
                this.setState({
                    isRemoving: false,
                    removeError: "The request to remove dataset has failed",
                });
            });
        this.setState({ isRemoving: true });
    }

    render() {
        const { datasetName, stats } = this.props;
        const { isUser, showModal } = this.state;
        const renderTooltip = <Tooltip id="rm-dataset-btn">Remove this dataset from server</Tooltip>;

        return (
            <Navbar expand="md">
                <Navbar.Brand href={"."}>
                    <img
                        alt=""
                        src="logo192.png"
                        width="25"
                        height="25"
                        className="d-inline-block align-top"
                    />{" "}
                    CorGIE: <span className="text-underline">Cor</span>responding a{" "}
                    <span className="text-underline">G</span>raph to <span className="text-underline">I</span>
                    ts <span className="text-underline">E</span>mbedding
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="responsive-navbar-nav" />
                <Navbar.Collapse id="responsive-navbar-nav">
                    <Nav className="mr-auto">
                        <Nav.Item>
                            <Link to="upload">Upload</Link>
                        </Nav.Item>
                    </Nav>
                    <Navbar.Text className="justify-content-end">
                        {datasetName
                            ? `Dataset: ${datasetName} (V=${stats.numNodes}, E=${stats.numEdges})`
                            : ""}
                        {isUser && (
                            <OverlayTrigger
                                placement="bottom"
                                delay={{ show: 250, hide: 400 }}
                                overlay={renderTooltip}
                            >
                                <span
                                    className="del-btn"
                                    style={{ marginLeft: "10px" }}
                                    onClick={this.toggleModal}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                </span>
                            </OverlayTrigger>
                        )}
                    </Navbar.Text>
                </Navbar.Collapse>
                {isUser && showModal && this.renderModal()}
            </Navbar>
        );
    }
}
