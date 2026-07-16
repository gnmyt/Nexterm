import { useRef } from "react";
import Icon from "@mdi/react";
import { mdiCalendarBlankOutline, mdiClose } from "@mdi/js";
import "./styles.sass";

export const DateInput = ({ value, setValue, onChange, id, disabled = false, includeTime = true,
                              min, max, placeholder, }) => {
    const inputRef = useRef(null);

    const handleChange = (event) => {
        setValue?.(event.target.value);
        onChange?.(event);
    };

    const handleClear = (event) => {
        event.stopPropagation();
        if (disabled) return;
        setValue?.("");
        onChange?.({ target: { value: "" } });
    };

    const openPicker = () => {
        if (disabled) return;
        inputRef.current?.showPicker();
    };

    return (
        <div className={`date-input ${disabled ? "disabled" : ""} ${value ? "has-value" : ""}`}
             onClick={openPicker}>
            <Icon className="date-input__icon" path={mdiCalendarBlankOutline} />
            <input
                ref={inputRef}
                id={id}
                type={includeTime ? "datetime-local" : "date"}
                className="date-input__field"
                value={value || ""}
                onChange={handleChange}
                disabled={disabled}
                min={min}
                max={max}
                placeholder={placeholder}
                aria-label={placeholder}
            />
            {value && !disabled && (
                <button type="button" className="date-input__clear" onClick={handleClear}
                        aria-label="Clear date">
                    <Icon path={mdiClose} />
                </button>
            )}
        </div>
    );
};
