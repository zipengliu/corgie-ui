import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Dropdown, Button, ButtonGroup, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretRight, faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { format as d3Format } from "d3";
import { Stage, Layer } from "react-konva";
import { range as lodashRange } from "lodash";
import { highlightNodes, changeHops, changeParam, hoverNode, searchNodes } from "../actions";
import ColorLegend from "./ColorLegend";
import NodeRep from "./NodeRep";

export class SettingsView extends Component {
    colorByNaming = {
        umap: "UMAP position",
        "pred-labels": "predicted labels",
        "true-labels": "true labels",
        correctness: "label correctness",
        "node-type": "node type",
    };
    nodeLabelNaming = {
        all: "all",
        correct: "correct prediction",
        wrong: "wrong prediction",
    };

    componentDidMount() {
        const { attrMeta, numNodeClasses } = this.props;
        for (let i = 0; i < attrMeta.length; i++) {
            const a = attrMeta[i];
            this.colorByNaming[i] = `${a.nodeType}: ${a.name}`; // Use the attribute name as colorBy for convinience
        }
        if (numNodeClasses) {
            for (let i = 0; i < numNodeClasses; i++) {
                this.nodeLabelNaming[`pred-${i}`] = `predicted: ${i}`;
                this.nodeLabelNaming[`true-${i}`] = `true: ${i}`;
            }
        }
    }

    hoverNodeType(typeId) {
        const { nodes } = this.props.graph;
        const targets = nodes.filter((x) => x.typeId === typeId).map((x) => x.id);
        this.props.hoverNode(targets);
    }

    hoverNodeLabel(labelId) {
        const { nodes } = this.props.graph;
        const { colorBy } = this.props.param;
        const f = colorBy === "pred-labels" ? "pl" : "tl";
        const targets = nodes.filter((x) => x[f] === labelId).map((x) => x.id);
        this.props.hoverNode(targets);
    }

    callSearch(e) {
        e.preventDefault();
        const formData = new FormData(e.target),
            { searchLabel, searchId } = Object.fromEntries(formData.entries());
        if (searchLabel) {
            this.props.searchNodes(searchLabel, null);
        } else {
            const t = parseInt(searchId);
            if (!isNaN(t)) {
                this.props.searchNodes(null, t);
            }
        }
    }

    render() {
        const { graph, param, attrMeta, changeParam, hoverNode, highlightNodes } = this.props;
        const { numNodeClasses, hasLinkPredictions } = this.props;
        const { colorByNaming, nodeLabelNaming } = this;
        const { nodeTypes } = graph;
        const { colorBy, colorScale, nodeSize, hops, hopsHover, hopsHighlight } = param;
        const { searchShown } = param.nodeFilter;
        const { highlightNodeType, highlightNodeLabel } = param;
        let e, numberFormat;
        const useAttrColors = Number.isInteger(colorBy);
        if (useAttrColors) {
            e = colorScale.domain();
            numberFormat = e[0] < 1 ? d3Format("~g") : d3Format("~s");
        }

        return (
            <div id="settings-view" className="view">
                <h5 className="view-title text-center">Settings</h5>
                <div className="view-body">
                    <div style={{ marginRight: "5px" }}>
                        {/* <div className="text-center">Node visuals</div> */}
                        {/* Shape legends for node type  */}
                        {nodeTypes.length > 1 && (
                            <div className="setting-item">
                                {/* <div className="setting-label">Shape:</div> */}
                                <div className="node-rep-legends node-shape">
                                    {nodeTypes.map((nt, i) => (
                                        <div
                                            className="legend-item"
                                            key={i}
                                            onMouseOver={this.hoverNodeType.bind(this, i)}
                                            onMouseOut={hoverNode.bind(null, null)}
                                            onClick={highlightNodes.bind(null, null, null, "node-type", i)}
                                        >
                                            <div className="visual-block">
                                                <Stage width={14} height={14}>
                                                    <Layer>
                                                        <NodeRep
                                                            x={7}
                                                            y={7}
                                                            radius={5}
                                                            typeId={i}
                                                            style={{
                                                                fill:
                                                                    colorBy === "node-type"
                                                                        ? nt.color
                                                                        : "grey",
                                                                strokeEnabled: false,
                                                            }}
                                                        />
                                                    </Layer>
                                                </Stage>
                                            </div>
                                            <div className="legend-label">{`${nt.name} (${nt.count})`}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="setting-item">
                            <div className="setting-label">Color:</div>
                            <div style={{ display: "inline-block" }}>
                                <Dropdown
                                    onSelect={(k) => {
                                        changeParam("colorBy", k, false);
                                    }}
                                >
                                    <Dropdown.Toggle id="color-by-toggle-btn" size="xxs" variant="primary">
                                        {colorByNaming[colorBy]}
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu>
                                        <Dropdown.Item eventKey="umap" active={colorBy === "umap"}>
                                            {colorByNaming["umap"]}
                                        </Dropdown.Item>

                                        {numNodeClasses && (
                                            <div>
                                                <Dropdown.Divider />
                                                {["pred-labels", "true-labels", "correctness"].map((k) => (
                                                    <Dropdown.Item
                                                        key={k}
                                                        eventKey={k}
                                                        active={colorBy === k}
                                                    >
                                                        {colorByNaming[k]}
                                                    </Dropdown.Item>
                                                ))}
                                            </div>
                                        )}

                                        {hasLinkPredictions && (
                                            <div>
                                                <Dropdown.Divider />
                                                <Dropdown.Item
                                                    eventKey={"correctness"}
                                                    active={colorBy === "correctness"}
                                                >
                                                    {colorByNaming["correctness"]}
                                                </Dropdown.Item>
                                            </div>
                                        )}

                                        {attrMeta.length > 0 && <Dropdown.Divider />}
                                        {attrMeta.map((a, i) => (
                                            <Dropdown.Item key={i} eventKey={i} active={colorBy === i}>
                                                {`${a.nodeType}: ${a.name}`}
                                            </Dropdown.Item>
                                        ))}

                                        {nodeTypes.length > 1 && (
                                            <div>
                                                <Dropdown.Divider />
                                                <Dropdown.Item eventKey="node-type">
                                                    {colorByNaming["node-type"]}
                                                </Dropdown.Item>
                                            </div>
                                        )}
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>

                            {/* Color legends */}
                            {useAttrColors && (
                                <ColorLegend
                                    cn="node-rep-legends node-color"
                                    scale={colorScale}
                                    numFormat={numberFormat}
                                />
                            )}
                            {/* {colorBy === "umap" && (
                                    <div className="node-rep-legends node-color">See colors below</div>
                                )} */}
                            {colorBy === "correctness" && (
                                <div className="node-rep-legends node-color">
                                    <div className="legend-item">
                                        <div
                                            className="visual-block"
                                            style={{ backgroundColor: colorScale(false) }}
                                        ></div>
                                        <div className="legend-label">correct</div>
                                    </div>
                                    <div className="legend-item">
                                        <div
                                            className="visual-block"
                                            style={{ backgroundColor: colorScale(true) }}
                                        ></div>
                                        <div className="legend-label">wrong</div>
                                    </div>
                                </div>
                            )}
                            {(colorBy === "pred-labels" || colorBy === "true-labels") && (
                                <div className="node-rep-legends node-color">
                                    {lodashRange(numNodeClasses).map((i) => (
                                        <div
                                            className="legend-item"
                                            key={i}
                                            onMouseOver={this.hoverNodeLabel.bind(this, i)}
                                            onMouseOut={hoverNode.bind(null, null)}
                                            onClick={highlightNodes.bind(null, null, null, "node-label", i)}
                                        >
                                            <div
                                                className="visual-block"
                                                style={{ backgroundColor: colorScale(i) }}
                                            ></div>
                                            <div className="legend-label">{i}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">Size:</div>
                            <ButtonGroup size="xxs">
                                <Button
                                    variant="outline-secondary"
                                    onClick={changeParam.bind(null, "nodeSize", nodeSize + 1, false, null)}
                                >
                                    +
                                </Button>
                                <Button
                                    variant="outline-secondary"
                                    onClick={() => {
                                        if (nodeSize > 1) {
                                            changeParam("nodeSize", nodeSize - 1);
                                        }
                                    }}
                                >
                                    -
                                </Button>
                            </ButtonGroup>
                        </div>
                    </div>
                    <div style={{ marginTop: "10px" }}>
                        {/* <div className="text-center">Filter for Interaction</div> */}

                        {(nodeTypes.length > 1 || numNodeClasses) && (
                            <div className="setting-item">
                                <div style={{ marginRight: "5px" }}>brushable targets: </div>
                                {nodeTypes.length > 1 && (
                                    <div style={{ marginRight: "15px" }}>
                                        {/* <span style={{ marginRight: "5px" }}>by node type</span> */}
                                        <Dropdown
                                            onSelect={(k) => {
                                                changeParam(
                                                    "highlightNodeType",
                                                    k === "all" ? k : parseInt(k)
                                                );
                                            }}
                                        >
                                            <Dropdown.Toggle
                                                id="highlight-node-type-dropdown"
                                                size="xxs"
                                                variant="primary"
                                            >
                                                {highlightNodeType === "all"
                                                    ? "all"
                                                    : nodeTypes[highlightNodeType].name}
                                            </Dropdown.Toggle>

                                            <Dropdown.Menu>
                                                <Dropdown.Item
                                                    eventKey="all"
                                                    active={highlightNodeType === "all"}
                                                >
                                                    all
                                                </Dropdown.Item>
                                                <Dropdown.Divider />
                                                {nodeTypes.map((nt, i) => (
                                                    <Dropdown.Item
                                                        key={i}
                                                        eventKey={i}
                                                        active={highlightNodeType === i}
                                                    >
                                                        node type: {nt.name}
                                                    </Dropdown.Item>
                                                ))}
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                )}
                                {numNodeClasses && (
                                    <div>
                                        {/* <span style={{ marginRight: "5px" }}>by node labels</span> */}
                                        <Dropdown
                                            onSelect={(k) => {
                                                changeParam("highlightNodeLabel", k);
                                            }}
                                        >
                                            <Dropdown.Toggle
                                                id="highlight-node-type-dropdown"
                                                size="xxs"
                                                variant="primary"
                                            >
                                                {nodeLabelNaming[highlightNodeLabel]}
                                            </Dropdown.Toggle>

                                            <Dropdown.Menu>
                                                <Dropdown.Item
                                                    eventKey="all"
                                                    active={highlightNodeLabel === "all"}
                                                >
                                                    {nodeLabelNaming["all"]}
                                                </Dropdown.Item>
                                                <Dropdown.Divider />

                                                <Dropdown.Item
                                                    eventKey="correct"
                                                    active={highlightNodeLabel === "correct"}
                                                >
                                                    {nodeLabelNaming["correct"]}
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    eventKey="wrong"
                                                    active={highlightNodeLabel === "wrong"}
                                                >
                                                    {nodeLabelNaming["wrong"]}
                                                </Dropdown.Item>
                                                <Dropdown.Divider />

                                                {lodashRange(numNodeClasses)
                                                    .map((labelId) => `pred-${labelId}`)
                                                    .map((k, i) => (
                                                        <Dropdown.Item
                                                            key={k}
                                                            eventKey={k}
                                                            active={highlightNodeLabel === k}
                                                        >
                                                            {`predicted: ${i}`}
                                                        </Dropdown.Item>
                                                    ))}
                                                <Dropdown.Divider />

                                                {lodashRange(numNodeClasses)
                                                    .map((labelId) => `true-${labelId}`)
                                                    .map((k, i) => (
                                                        <Dropdown.Item
                                                            key={k}
                                                            eventKey={k}
                                                            active={highlightNodeLabel === k}
                                                        >
                                                            {`truth: ${i}`}
                                                        </Dropdown.Item>
                                                    ))}
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="setting-item">
                            <span style={{ marginRight: "5px" }}>hops for hover:</span>
                            <div style={{ display: "inline-block" }}>
                                <Dropdown
                                    onSelect={(h) => {
                                        changeParam("hopsHover", parseInt(h), false);
                                    }}
                                >
                                    <Dropdown.Toggle id="hops-hover" size="xxs" variant="primary">
                                        {hopsHover}
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu>
                                        {new Array(hops + 1).fill(0).map((_, i) => (
                                            <Dropdown.Item key={i} eventKey={i} active={hopsHover === i}>
                                                {i}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>

                        <div className="setting-item">
                            <span style={{ marginRight: "5px" }}>hops for highlight:</span>
                            <div style={{ display: "inline-block" }}>
                                <Dropdown
                                    onSelect={(h) => {
                                        changeParam("hopsHighlight", parseInt(h), false);
                                    }}
                                >
                                    <Dropdown.Toggle id="hops-highlight" size="xxs" variant="primary">
                                        {hopsHighlight}
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu>
                                        {new Array(hops + 1).fill(0).map((_, i) => (
                                            <Dropdown.Item key={i} eventKey={i} active={hopsHighlight === i}>
                                                {i}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div>
                                <span
                                    style={{ cursor: "pointer" }}
                                    onClick={changeParam.bind(
                                        null,
                                        "nodeFilter.searchShown",
                                        null,
                                        true,
                                        null
                                    )}
                                >
                                    <FontAwesomeIcon icon={searchShown ? faCaretDown: faCaretRight} />
                                </span>
                                <span style={{ marginLeft: "5px" }}>Search nodes by</span>
                            </div>
                            {searchShown && (
                                <Form
                                    inline
                                    onSubmit={this.callSearch.bind(this)}
                                    style={{ marginLeft: "9px" }}
                                >
                                    <Form.Control
                                        className="search-text-box"
                                        id="search-node-label"
                                        placeholder="label"
                                        name="searchLabel"
                                        size="sm"
                                    ></Form.Control>
                                    <span style={{ margin: "0 5px" }}>or</span>
                                    <Form.Control
                                        className="search-text-box"
                                        id="search-node-id"
                                        placeholder="id"
                                        name="searchId"
                                        size="sm"
                                    ></Form.Control>
                                    <Button
                                        variant="outline-secondary"
                                        size="xs"
                                        style={{ marginLeft: "5px" }}
                                        type="submit"
                                    >
                                        search
                                    </Button>
                                </Form>
                            )}
                        </div>
                    </div>
                </div>

                {colorBy === "correctness" && hasLinkPredictions && (
                    <div className="view-footer">
                        Note: nodes with a wrong predicted link are deemed wrong.
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    graph: state.graph,
    param: state.param,
    attrMeta: state.attrMeta,
    numNodeClasses: state.numNodeClasses,
    hasLinkPredictions: state.hasLinkPredictions,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            hoverNode,
            changeHops,
            changeParam,
            searchNodes,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(SettingsView);
