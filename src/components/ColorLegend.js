import React from "react";

export default function ColorLegend({ cn, scale, domain, numFormat }) {
    const e = domain? domain: scale.domain();
    const colorMin = scale(e[0]),
        colorMid = scale((e[0] + e[1]) / 2),
        colorMax = scale(e[1]);

    return (
        <div className={cn}>
            <span style={{ marginRight: "3px" }}>{numFormat ? numFormat(e[0]) : e[0]}</span>
            <div
                style={{
                    display: "inline-block",
                    height: "10px",
                    width: "100px",
                    background: `linear-gradient(90deg, ${colorMin} 0%, ${colorMid} 50%, ${colorMax} 100%)`,
                }}
            ></div>
            <span style={{ marginLeft: "3px" }}>{numFormat ? numFormat(e[1]) : e[1]}</span>
        </div>
    );
}
