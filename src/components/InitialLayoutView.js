import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Spinner } from "react-bootstrap";
import GraphLayout from "./GraphLayout";
import { changeFocalParam } from "../actions";

export const ComputingSpinner = () => (
    <div style={{ margin: "10px" }}>
        <Spinner animation="border" role="status" size="sm" />
        <span style={{ marginLeft: "10px" }}>Computing...</span>
    </div>
);

function GraphView({ initialLayout }) {
    return (
        <div className="view" id="initial-graph-view">
            <h5 className="view-title text-center">Global Topology</h5>
            <div className="view-body">
                {initialLayout.running ? (
                    <ComputingSpinner />
                ) : (
                    <GraphLayout
                        layoutData={initialLayout}
                        useStrokeForFocal={true}
                        fromView="graph-layout"
                        showEdges={true}
                    />
                )}
            </div>
            <div className="view-footer">
                #nodes: {initialLayout.numNodes}, #edges: {initialLayout.numEdges}, Layout algorithm:{" "}
                {initialLayout.name}
            </div>
        </div>
    );
}

const mapStateToProps = (state) => ({
    initialLayout: state.initialLayout,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeFocalParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
