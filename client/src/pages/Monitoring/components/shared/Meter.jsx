import { getUsageLevel } from "./status.js";

export const Meter = ({ value, label, thresholds = true }) => {
    const percent = Math.max(0, Math.min(Number(value) || 0, 100));
    const level = thresholds ? getUsageLevel(percent) : "normal";

    return (
        <div className={`mon-meter mon-meter--${level}`} role="meter"
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
            <div className="mon-meter__fill" style={{ width: `${percent}%` }} />
        </div>
    );
};
