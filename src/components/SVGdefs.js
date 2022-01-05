export default function SVGdefs() {
    return (
        <svg>
            <defs>
                <marker
                    id="axis-arrow-head"
                    orient="auto"
                    markerWidth="4"
                    markerHeight="8"
                    refX="0.1"
                    refY="4"
                >
                    <path d="M0,0 V8 L4,4 Z" fill="black" />
                </marker>
            </defs>
        </svg>
    );
}
