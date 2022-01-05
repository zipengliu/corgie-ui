import React, { Component } from "react";
import { Table, Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import AppNav from "./AppNav";
import datasets from "../datasets";

export default class DatasetList extends Component {
    render() {
        return (
            <div>
                <AppNav />
                <Container>
                    <Row>
                        <h3 style={{ marginTop: "10px" }}>
                            A visualization tool for graph neural networks. See{" "}
                            <a href="http://www.cs.ubc.ca/labs/imager/tr/2021/corgie/"> HERE </a> for the
                            paper.
                        </h3>
                    </Row>

                    <Row>
                        <div
                            style={{
                                position: "relative",
                                overflow: "hidden",
                                width: "100%",
                                paddingTop: "45.23%",
                            }}
                        >
                            <iframe
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    bottom: 0,
                                    right: 0,
                                }}
                                src="https://www.youtube.com/embed/sQMF50aNtKI"
                                title="YouTube video player"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen
                            ></iframe>
                        </div>
                    </Row>

                    <Row>
                        <div style={{ fontSize: "large", margin: "20px 0" }}>
                            You can try CorGIE on the following datasets now. <br /> We will provide the code
                            and detailed instructions about how to install it locally and how to preprocess
                            your own dataset.
                        </div>
                    </Row>

                    <Row>
                        <Table striped hover bordered>
                            <thead>
                                <tr>
                                    <th> # </th>
                                    <th> Name </th>
                                    <th> Source </th>
                                    <th> #Nodes </th>
                                    <th> #Edges </th>
                                    <th> #Node types </th>
                                    <th> Node features </th>
                                    <th> #Hops </th>
                                    <th> Notes </th>
                                </tr>
                            </thead>
                            <tbody>
                                {datasets.map((d, i) => (
                                    <tr key={i}>
                                        <td> {i + 1} </td>
                                        <td>
                                            <Link to={`/${d.id}`}> {d.name} </Link>
                                        </td>
                                        <td> {d.source} </td>
                                        <td className="cell-num"> {d.numNodes} </td>
                                        <td className="cell-num"> {d.numEdges} </td>
                                        <td className="cell-num"> {d.numTypes} </td>
                                        <td> {d.nodeFeatures} </td>
                                        <td className="cell-num"> {d.hops} </td>
                                        <td> {d.desc} </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Row>
                </Container>
            </div>
        );
    }
}
