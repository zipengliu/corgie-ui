import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretUp, faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { selectNodes, highlightNodes, selectNodePair, changeParam, highlightNodePairs } from "../actions";

export class HighlightControl extends Component {
    render() {
        const { selectedNodes, highlightedNodes, numHighlightsAndFocus, hideHighlightView } = this.props;
        const { unseenTopK, hasLinkPredictions } = this.props;
        const { selectNodes, selectNodePair, highlightNodes, highlightNodePairs, changeParam } = this.props;
        const areHighlightsAlsoFocus =
            highlightedNodes.length && numHighlightsAndFocus === highlightedNodes.length;

        const btns = [];
        btns.push(
            <OverlayTrigger
                placement="bottom"
                overlay={
                    <Tooltip id="action-tooltip-create">
                        {areHighlightsAlsoFocus ? "single out " : "create "}a new focal group
                    </Tooltip>
                }
            >
                <div
                    className="circle action"
                    onClick={selectNodes.bind(
                        null,
                        areHighlightsAlsoFocus ? "SINGLE OUT" : "CREATE",
                        highlightedNodes,
                        null
                    )}
                >
                    {/* <FontAwesomeIcon icon={faPlus} /> */}
                    create
                </div>
            </OverlayTrigger>
        );
        btns.push(
            <OverlayTrigger
                placement="bottom"
                overlay={<Tooltip id="action-tooltip-clear">Clear highlights</Tooltip>}
            >
                <div className="circle action" onClick={highlightNodes.bind(null, [], null, null, null)}>
                    {/* <FontAwesomeIcon icon={faTrash} /> */}
                    clear
                </div>
            </OverlayTrigger>
        );
        if (highlightedNodes.length === 2) {
            btns.push(
                <OverlayTrigger
                    placement="bottom"
                    overlay={
                        <Tooltip id="action-tooltip-compare">Remove all and compare the two nodes</Tooltip>
                    }
                >
                    <div
                        className="circle action"
                        onClick={selectNodePair.bind(null, highlightedNodes[0], highlightedNodes[1])}
                    >
                        compare
                    </div>
                </OverlayTrigger>
            );
        }

        if (selectedNodes.length > 0 && !areHighlightsAlsoFocus) {
            for (let i = 0; i < selectedNodes.length; i++) {
                btns.push(
                    <OverlayTrigger
                        placement="bottom"
                        overlay={
                            <Tooltip id="action-tooltip-add-to">
                                Add the highlighted nodes to an existing focal group
                            </Tooltip>
                        }
                    >
                        <div
                            className="circle action"
                            onClick={selectNodes.bind(null, "APPEND", highlightedNodes, i)}
                        >
                            add to <br /> foc-{i}
                        </div>
                    </OverlayTrigger>
                );
            }
        }

        if (areHighlightsAlsoFocus) {
            btns.push(
                <OverlayTrigger
                    placement="bottom"
                    overlay={
                        <Tooltip id="action-tooltip-remove-from">
                            Remove highlighted nodes from focus group
                        </Tooltip>
                    }
                >
                    <div
                        className="circle action"
                        onClick={selectNodes.bind(null, "REMOVE FROM", highlightedNodes, null)}
                    >
                        purge
                    </div>
                </OverlayTrigger>
            );
        }

        if (hasLinkPredictions) {
            btns.push(
                <OverlayTrigger
                    placement="bottom"
                    overlay={
                        <Tooltip id="action-tooltip-recomm">
                            List top {unseenTopK} predicted unseen edges
                        </Tooltip>
                    }
                >
                    <div
                        className="circle action"
                        onClick={highlightNodePairs.bind(null, null, null, null, null, true)}
                    >
                        predict
                    </div>
                </OverlayTrigger>
            );
        }
        const n = btns.length;
        const u = Math.PI / (n + 1);
        const r = n < 5 ? 110 : 120;

        return (
            <div
                className={`view ${highlightedNodes.length && !hideHighlightView ? "" : "hide"}`}
                id="highlight-view"
            >
                <div className="paw"></div>
                <h5 className="view-title center-pad">
                    {highlightedNodes.length} nodes <br />
                    highlighted
                </h5>

                <div
                    style={{
                        position: "absolute",
                        top: hideHighlightView && highlightedNodes.length ? "170px" : "-5px",
                        right: hideHighlightView ? "65px" : "-50px",
                        color: "black",
                        cursor: "pointer",
                        zIndex: 250,
                    }}
                    onClick={changeParam.bind(null, "hideHighlightView", null, true, null)}
                >
                    <OverlayTrigger
                        placement="bottom"
                        overlay={
                            <Tooltip id="action-tooltip-remove-from">
                                {hideHighlightView ? "Show" : "Hide"} menu
                            </Tooltip>
                        }
                    >
                        <FontAwesomeIcon icon={hideHighlightView ? faCaretDown : faCaretUp} />
                    </OverlayTrigger>
                </div>

                {btns.map((b, i) => (
                    <div
                        key={i}
                        className="action-wrapper"
                        style={{ top: r * Math.sin(u * (i + 1)) + 30, left: -r * Math.cos(u * (i + 1)) + 12 }}
                        // style={{ top: r * Math.sin(0) + 30, left: -r * Math.cos(0) }}
                    >
                        {b}
                    </div>
                ))}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    hideHighlightView: state.param.hideHighlightView,
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
    unseenTopK: state.param.unseenTopK,
    hasLinkPredictions: state.hasLinkPredictions,
    numHighlightsAndFocus: state.highlightedNodes.reduce(
        (prev, cur) => prev + (state.isNodeSelected[cur] ? 1 : 0),
        0
    ),
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
            highlightNodes,
            selectNodePair,
            changeParam,
            highlightNodePairs,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(HighlightControl);
