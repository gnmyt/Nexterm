import "./styles.sass";
import Icon from "@mdi/react";

export const Chip = ({ label, selected, onClick, icon, disabled = false }) => {
    return (
        <button
            className={`chip ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
            onClick={() => !disabled && onClick?.(!selected)}
            disabled={disabled}
            type="button"
        >
            {icon && <Icon path={icon} />}
            <span>{label}</span>
        </button>
    );
};
