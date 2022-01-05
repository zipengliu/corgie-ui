import React from "react";
import { Circle, RegularPolygon, Star } from "react-konva";

function NodeRep({ typeId, x, y, radius, style, events }) {
    if (typeId === 0) {
        return <Circle x={x} y={y} radius={radius} {...style} {...events} />;
    }
    if (typeId <= 2 || (typeId & 1) === 0) {
        return <RegularPolygon x={x} y={y} radius={radius} sides={typeId + 2} {...style} {...events} />;
    }
    return (
        <Star
            numPoints={typeId + 2}
            innerRadius={radius - 1}
            outerRadius={radius + 2}
            x={x}
            y={y}
            {...style}
            {...events}
        />
    );
}

export default NodeRep;
