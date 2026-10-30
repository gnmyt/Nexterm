import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCheck, mdiClose, mdiMinus } from "@mdi/js";
import Tooltip from "@/common/components/Tooltip";

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
                    <Tooltip key={state.key} text={inheritedHint} disabled={!isInherited} delay={500} asChild>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={active === state.key}
                            className={`tri-segment ${state.key} ${active === state.key ? "active" : ""} ${isInherited ? "inherited" : ""}`}
                            disabled={disabled}
                            onClick={() => !disabled && onChange && onChange(state.key)}
                        >
                            <Icon path={state.icon} />
                        </button>
                    </Tooltip>
                );
            })}
        </div>
    );
};