import React, { Component, useCallback, memo } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Dropdown, OverlayTrigger, Tooltip, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCompressAlt, faExpandAlt, faWrench } from "@fortawesome/free-solid-svg-icons";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { scaleSequential, interpolateGreys, scaleSequentialLog } from "d3";
import debounce from "lodash.debounce";
import { Stage, Layer, Group, Rect } from "react-konva";
import ColorLegend from "./ColorLegend";
import { changeParam, hoverNode, highlightNodes } from "../actions";

const SettingModal = ({ params, changeParam }) => (
    <Modal
        show={params.showSettings}
        centered
        id="latent-neighbor-blocks-settings-modal"
        onHide={changeParam.bind(null, "neighborLatentMap.showSettings", false, null, null)}
    >
        <Modal.Header closeButton>
            <Modal.Title>Settings for latent neighbor blocks</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form inline>
                <Form.Label style={{ marginRight: "5px" }}>Choose scale type:</Form.Label>
                <Form.Check
                    inline
                    label="linear"
                    type="radio"
                    id="scale-linear-nei"
                    checked={params.useLinearScale}
                    onChange={changeParam.bind(null, "neighborLatentMap.useLinearScale", null, true, null)}
                />
                <Form.Check
                    inline
                    label="log10"
                    type="radio"
                    id="scale-log-nei"
                    checked={!params.useLinearScale}
                    onChange={changeParam.bind(null, "neighborLatentMap.useLinearScale", null, true, null)}
                />
            </Form>
        </Modal.Body>
    </Modal>
);
export class NeighborLatentMap extends Component {
    render() {
        const { changeParam, hoverNode, highlightNodes, param } = this.props;
        const { isOpen, useLinearScale, hop } = param;
        const { binsByHop, maxBinVals, granu, mapping } = this.props.data;
        const { gap, cellSize } = this.props.spec;
        const binData = binsByHop[hop - 1]; // TODO could be changed by user
        const blockSize = cellSize * granu,
            canvasSize = (blockSize + gap) * granu + gap;
        let cntScale;
        if (useLinearScale) {
            cntScale = scaleSequential(interpolateGreys).domain([0, maxBinVals[hop - 1]]);
        } else {
            const getColorLogScale = (domainMax) => {
                const s = scaleSequentialLog(interpolateGreys).domain([1, domainMax + 1]);
                return (x) => s(x + 1);
            };
            cntScale = getColorLogScale(maxBinVals[hop - 1]);
        }

        const BlockRep = memo(({ block, x, y }) => {
            // TODO potentiall buggy, should just change class component to function
            const debouncedHover = useCallback(debounce((x) => hoverNode(x), 300));
            return (
                <Group
                    onClick={highlightNodes.bind(null, mapping[x][y], null, "neighbor-latent-map", null)}
                    onMouseOver={debouncedHover.bind(null, mapping[x][y])}
                    onMouseOut={debouncedHover.bind(null, null)}
                >
                    {block.map((col, i) => (
                        <Group key={i} x={cellSize * i} y={0}>
                            {col.map((val, j) => (
                                <Rect
                                    key={j}
                                    x={0}
                                    y={cellSize * j}
                                    width={cellSize}
                                    height={cellSize}
                                    strokeEnabled={i === x && j === y}
                                    stroke="red"
                                    strokeWidth={1}
                                    fill={cntScale(val)}
                                />
                            ))}
                        </Group>
                    ))}
                </Group>
            );
        });

        return (
            <div className="view" id="neighbor-latent-map" style={{ width: canvasSize + 30 }}>
                <h5 className="view-title">
                    <span
                        className="left-btn"
                        onClick={changeParam.bind(null, "neighborLatentMap.isOpen", null, true, null)}
                    >
                        <FontAwesomeIcon icon={isOpen ? faCompressAlt : faExpandAlt} />
                    </span>
                    Latent Neighbor Blocks
                    <span style={{ marginLeft: "5px", cursor: "pointer" }}>
                        <OverlayTrigger
                            placement="right"
                            overlay={
                                <Tooltip id="neighbor-latent-map-tooltip">
                                    A block = the neighbor distribution of nodes located in an area of 2D
                                    latent space. <br /> Luminance of a cell in a block = # their neighbors
                                    located in that area of 2D latent space.
                                </Tooltip>
                            }
                        >
                            <FontAwesomeIcon icon={faQuestionCircle} />
                        </OverlayTrigger>
                    </span>
                    <span
                        className="right-btn"
                        onClick={changeParam.bind(null, "neighborLatentMap.showSettings", true, null, null)}
                    >
                        <FontAwesomeIcon icon={faWrench} />
                    </span>
                </h5>
                <div className="view-body" style={{ display: isOpen ? "block" : "none" }}>
                    <Stage width={canvasSize} height={canvasSize}>
                        <Layer x={gap} y={gap}>
                            {binData.map((blockX, i) => (
                                <Group key={i} x={(blockSize + gap) * i} y={0}>
                                    {blockX.map((block, j) =>
                                        mapping[i][j].length > 0 ? (
                                            <Group key={j} x={0} y={(blockSize + gap) * j}>
                                                {/* border of a block */}
                                                <Rect
                                                    x={0}
                                                    y={0}
                                                    width={blockSize}
                                                    height={blockSize}
                                                    fillEnabled={false}
                                                    stroke="grey"
                                                    strokeWidth={0.5}
                                                />
                                                <BlockRep block={block} x={i} y={j} />
                                            </Group>
                                        ) : (
                                            <Group key={j} />
                                        )
                                    )}
                                </Group>
                            ))}
                        </Layer>
                    </Stage>
                    <div style={{ display: "flex", flexDirection: "row", marginTop: "5px" }}>
                        <div style={{ marginRight: "5px" }}>
                            <span style={{ marginRight: "5px" }}>#neighbors within </span>
                            <div style={{ display: "inline-block" }}>
                                <Dropdown
                                    onSelect={(h) => {
                                        changeParam("neighborLatentMap.hop", parseInt(h), false);
                                    }}
                                >
                                    <Dropdown.Toggle
                                        id="hops-to-show-nei"
                                        size="xxs"
                                        variant="outline-secondary"
                                    >
                                        {hop}
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu>
                                        {new Array(this.props.hops).fill(0).map((_, i) => (
                                            <Dropdown.Item key={i} eventKey={i + 1} active={hop === i + 1}>
                                                {i + 1}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                            <span style={{ marginLeft: "5px" }}>hops: </span>
                        </div>
                        <ColorLegend scale={cntScale} domain={[0, maxBinVals[hop - 1]]} />
                    </div>
                </div>

                <SettingModal params={param} changeParam={changeParam} />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    data: state.latent.neighborPos,
    spec: state.spec.neighborLatentMap,
    param: state.param.neighborLatentMap,
    hops: state.param.hops,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators({ changeParam, hoverNode, highlightNodes }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NeighborLatentMap);
