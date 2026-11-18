import { useId, useMemo } from "react";

const WIDTH = 100, HEIGHT = 32, PAD = 2;

export const Sparkline = ({ values, max = 100, level = "normal", label }) => {
    const gradientId = useId();

    const paths = useMemo(() => {
        const points = (values || []).filter(value => value != null);
        if (points.length < 2) return null;
        const top = Math.max(max, ...points) || 1;
        const coords = points.map((value, i) => [
            (i / (points.length - 1)) * WIDTH,
            HEIGHT - PAD - (Math.max(0, value) / top) * (HEIGHT - PAD * 2),
        ]);
        const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
        return { line, area: `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z` };
    }, [values, max]);

    if (!paths) return <div className="mon-sparkline mon-sparkline--empty" aria-hidden="true" />;

    return (
        <svg className={`mon-sparkline mon-sparkline--${level}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"
             role="img" aria-label={label}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className="mon-sparkline__stop-top" />
                    <stop offset="100%" className="mon-sparkline__stop-bottom" />
                </linearGradient>
            </defs>
            <path d={paths.area} fill={`url(#${gradientId})`} />
            <path d={paths.line} className="mon-sparkline__line" />
        </svg>
    );
};
