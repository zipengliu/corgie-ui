import React, { Component } from "react";

const initState = {
    mouseDown: false,
    startPoint: null, // page x and y of starting point
    endPoint: null,
    brushedArea: null, // Coordinates for the brushed area
};

export default class Brush extends Component {
    constructor(props) {
        super(props);
        this.boxRef = React.createRef();
        this.state = initState;
    }

    _onMouseDown(e) {
        let nextState = {
            mouseDown: true,
            startPoint: { x: e.pageX, y: e.pageY },
            mouseMoveFunc: this._onMouseMove.bind(this),
            mouseUpFunc: this._onMouseUp.bind(this),
        };
        nextState.brushedArea = this._calcBrushedArea(nextState.startPoint, nextState.startPoint);
        this.setState(nextState);
        window.document.addEventListener("mousemove", nextState.mouseMoveFunc);
        window.document.addEventListener("mouseup", nextState.mouseUpFunc);
    }

    _onMouseUp(e) {
        window.document.removeEventListener("mousemove", this.state.mouseMoveFunc);
        window.document.removeEventListener("mouseup", this.state.mouseUpFunc);
        const brushedArea = { ...this.state.brushedArea };
        this.setState(initState);
        if (this.props.isRange) {
            this.props.brushedFunc(brushedArea.x, brushedArea.x + brushedArea.width);
        } else {
            this.props.brushedFunc(brushedArea);
        }
    }

    _onMouseMove(e) {
        e.preventDefault();
        if (this.state.mouseDown) {
            let endPoint = { x: e.pageX, y: e.pageY };
            this.setState({
                endPoint,
                brushedArea: this._calcBrushedArea(this.state.startPoint, endPoint),
            });
        }
    }

    _calcBrushedArea(startPoint, endPoint) {
        if (startPoint == null || endPoint == null) {
            return null;
        }
        const parentNode = this.boxRef.current;
        const rect = parentNode.getBoundingClientRect();
        const x = Math.min(startPoint.x, endPoint.x) - (rect.left + window.scrollX);
        const y = Math.min(startPoint.y, endPoint.y) - (rect.top + window.scrollY);
        const width = Math.abs(startPoint.x - endPoint.x);
        const height = Math.abs(startPoint.y - endPoint.y);
        // console.log({rect, startPoint, endPoint, x, y});
        return {
            x,
            y,
            width,
            height,
        };
    }

    render() {
        const { brushedArea } = this.state;
        const { isRange } = this.props;
        return (
            <g>
                {brushedArea != null && (
                    <rect
                        className="brushed-area"
                        x={brushedArea.x}
                        y={isRange ? 0 : brushedArea.y}
                        width={brushedArea.width}
                        height={isRange ? this.props.height : brushedArea.height}
                    />
                )}
                {brushedArea == null && this.props.brushedArea !== null && (
                    <rect className="brushed-area" {...this.props.brushedArea} />
                )}

                <rect
                    className="brushable-area"
                    x={0}
                    y={0}
                    width={this.props.width}
                    height={this.props.height}
                    ref={this.boxRef}
                    onMouseDown={this._onMouseDown.bind(this)}
                    style={{ cursor: "crosshair" }}
                />
            </g>
        );
    }
}
