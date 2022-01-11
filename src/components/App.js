import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { withRouter } from "react-router-dom";
import { fetchGraphData } from "../actions";
import AppNav from "./AppNav";
import InitialLayoutView from "./InitialLayoutView";
import FocalLayoutView from "./FocalLayoutView";
import EmbeddingsView from "./EmbeddingsView";
// import PowerSetIntersectionView from "./PowerSetIntersectionView";
import DetailView from "./DetailView";
// import AdjacencyMatrix from "./AdjacencyMatrix";
import NodeAttrView from "./NodeAttrView";
import HighlightControl from "./HighlightControl";
import FocusControl from "./FocusControl";
import SettingsView from "./SettingsView";
import DistanceView from "./DistanceView";
import NeighborLatentMap from "./NeighborLatentMap";
import SVGdefs from "./SVGdefs";
import "./App.css";

class App extends Component {
    constructor(props) {
        super(props);
        this.appRef = React.createRef();
        this.leftColRef = React.createRef();
        this.state = { rightWidth: null };
        this.bindedUpdate = this.updateDimensions.bind(this);
    }
    updateDimensions() {
        if (this.props.loaded) {
            const bboxParent = this.appRef.current.getBoundingClientRect(),
                bboxLeft = this.leftColRef.current.getBoundingClientRect();
            // const bboxLeft = 640;
            this.setState({ rightWidth: bboxParent.width - bboxLeft.width - 10 });
        }
    }
    componentDidMount() {
        const { datasetId } = this.props.match.params;
        window.addEventListener("resize", this.bindedUpdate);
        this.props.fetchGraphData(datasetId);
    }
    componentWillUnmount() {
        window.removeEventListener("resize", this.bindedUpdate);
    }
    componentDidUpdate() {
        if (this.props.loaded && !this.state.rightWidth) {
            this.updateDimensions();
        }
    }

    render() {
        if (!this.props.loaded) {
            return (
                <div className="App">
                    <h3>Loading data...</h3>
                    {this.props.error && <p>{this.props.error}</p>}
                </div>
            );
        }
        const { numNodes, numEdges, datasetId, datasetName, hasNodeFeatures, neighborMapOpen } = this.props;
        const { rightWidth } = this.state;

        const interactionViews = (
            <div>
                <SettingsView />
                <FocusControl />
            </div>
        );

        return (
            <div>
                <AppNav
                    datasetName={datasetName ? datasetName : datasetId}
                    datasetId={datasetId}
                    stats={{ numNodes, numEdges }}
                />

                <HighlightControl />
                <div className="App" ref={this.appRef}>
                    <div ref={this.leftColRef} style={{ flexShrink: 1 }}>
                        {neighborMapOpen ? (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    justifyContent: "flex-end",
                                    alignItems: "stretch",
                                }}
                            >
                                <EmbeddingsView />
                                <NeighborLatentMap />
                            </div>
                        ) : (
                            <div
                                style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end" }}
                            >
                                {interactionViews}
                                <div>
                                    <EmbeddingsView />
                                    <NeighborLatentMap />
                                </div>
                            </div>
                        )}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                alignItems: "flex-start",
                            }}
                        >
                            {neighborMapOpen && interactionViews}
                            <DistanceView />
                        </div>
                    </div>
                    <div style={{ maxWidth: rightWidth ? rightWidth + "px" : "auto", flexGrow: 2 }}>
                        {hasNodeFeatures && <NodeAttrView />}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "flex-start",
                                alignItems: "flex-start",
                                flexWrap: "wrap",
                            }}
                        >
                            <FocalLayoutView />
                            <InitialLayoutView />
                        </div>
                    </div>
                </div>
                <SVGdefs />
                <DetailView />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    datasetId: state.datasetId,
    datasetName: state.datasetName,
    loaded: state.loaded,
    numNodes: state.loaded ? state.graph.nodes.length : 0,
    numEdges: state.loaded ? state.graph.edges.length : 0,
    hasNodeFeatures: state.loaded && (state.nodeAttrs.active || state.featureAgg.active),
    neighborMapOpen: state.param.neighborLatentMap.isOpen,
    error: state.error,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            fetchGraphData,
        },
        dispatch
    );

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(App));
