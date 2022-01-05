import React, { Component } from "react";
import { connect } from "react-redux";

class DetailView extends Component {
    render() {
        const { nodeTypes, hoverNode } = this.props;
        if (!hoverNode) return <div />;
        const useId = !hoverNode.label;

        return (
            <div id="node-label-tooltip">
                {nodeTypes.length > 1 && <div>Type: {nodeTypes[hoverNode.typeId].name}</div>}
                <div>{useId? `ID: ${hoverNode.id}`: `Label: ${hoverNode.label}`}</div>
            </div>
        );
        // return (
        //     <div id="detail-view">
        //         {nodeInfo.map((info, i) => (
        //             <p key={i}>{JSON.stringify(info)}</p>
        //         ))}
        //     </div>
        // );
    }
}

const mapStateToProps = (state) => ({
    // nodeInfo: state.hoveredNodes.map((n) => state.graph.nodes[n]),
    nodeTypes: state.graph.nodeTypes,
    hoverNode: state.hoveredNodes.length === 1 ? state.graph.nodes[state.hoveredNodes[0]] : null,
});

export default connect(mapStateToProps)(DetailView);
