import React, { Component, memo, useCallback } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Button, Badge } from "react-bootstrap";
import cn from "classnames";
import { FixedSizeList } from "react-window";
import debounce from "lodash.debounce";
import { selectNodePair, highlightNodePairs, hoverNode } from "../actions";

export class NodePairList extends Component {
    render() {
        const { nodes, highlightedNodePairs, selectedPairIdx } = this.props;
        const { selectNodePair, highlightNodePairs } = this.props;

        const labelOrId = nodes && nodes[0].label ? "label" : "id";
        const NodePairItem = memo(({ index, style }) => {
            const p = highlightedNodePairs[index];
            const debouncedHover = useCallback(debounce((x) => this.props.hoverNode(x), 200));
            return (
                <div
                    className={cn("list-group-item", { selected: index === selectedPairIdx })}
                    onMouseEnter={debouncedHover.bind(this, [p[0], p[1]])}
                    onMouseLeave={debouncedHover.bind(this, null)}
                    onClick={selectNodePair.bind(null, p[0], p[1])}
                    style={style}
                >
                    {nodes[p[0]][labelOrId]} - {nodes[p[1]][labelOrId]}
                </div>
            );
        });

        return (
            <div style={{ minWidth: "120px" }}>
                {/* <h6>Node pairs</h6> */}
                <div>
                    <Badge variant="primary">{highlightedNodePairs.length}</Badge> pairs highlighted.
                    {/* {highlightedNodePairs.length > 0 && "Click to focus."} */}
                </div>
                {highlightedNodePairs.length > 0 && (
                    <div>
                        <div className="node-pair-list">
                            <FixedSizeList
                                className="list-group"
                                height={
                                    highlightedNodePairs.length > 8 ? 200 : 25 * highlightedNodePairs.length
                                }
                                width="100%"
                                itemSize={25}
                                itemCount={highlightedNodePairs.length}
                            >
                                {NodePairItem}
                            </FixedSizeList>
                        </div>
                        <div>
                            <Button
                                variant="primary"
                                size="xs"
                                onClick={highlightNodePairs.bind(null, null, null, null)}
                            >
                                clear
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

const getSelectedPairIdx = (pairs, selectedNodes) => {
    if (selectedNodes.length !== 2 || selectedNodes[0].length !== 1 || selectedNodes[1].length !== 1)
        return -1;
    const s1 = selectedNodes[0][0],
        s2 = selectedNodes[1][0];
    for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        if ((p[0] === s1 && p[1] === s2) || (p[0] === s2 && p[1] === s1)) {
            return i;
        }
    }
    return -1;
};

const mapStateToProps = (state) => ({
    nodes: state.graph.nodes,
    highlightedNodePairs: state.highlightedNodePairs,
    selectedPairIdx: getSelectedPairIdx(state.highlightedNodePairs, state.selectedNodes),
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodePair,
            highlightNodePairs,
            hoverNode,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(NodePairList);
