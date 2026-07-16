import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCheck, mdiClose, mdiMinus } from "@mdi/js";

const STATES = [
    { key: "deny", icon: mdiClose },
    { key: "neutral", icon: mdiMinus },
    { key: "allow", icon: mdiCheck },
];

export const TriToggle = ({ value = "neutral", onChange, disabled = false, inherited = null, inheritedHint }) => {
    const active = STATES.some((s) => s.key === value) ? value : "neutral";
    const showInherited = active === "neutral" && (inherited === "allow" || inherited === "deny");

    return (
        <div className={`tri-toggle state-${active} ${disabled ? "disabled" : ""}`} role="radiogroup">
            {STATES.map((state) => {
                const isInherited = showInherited && inherited === state.key;
                return (
                    <button
                        key={state.key}
                        type="button"
                        role="radio"
                        aria-checked={active === state.key}
                        className={`tri-segment ${state.key} ${active === state.key ? "active" : ""} ${isInherited ? "inherited" : ""}`}
                        title={isInherited ? inheritedHint : undefined}
                        disabled={disabled}
                        onClick={() => !disabled && onChange && onChange(state.key)}
                    >
                        <Icon path={state.icon} />
                    </button>
                );
            })}
        </div>
    );
};