import "./styles.sass";

export const TextArea = ({ ref, id, value, setValue, onChange, onKeyDown, placeholder, rows = 4, mono = false, resize = "vertical",
                             disabled, autoFocus, maxLength }) => {
    const handleChange = (event) => {
        if (setValue) setValue(event.target.value);
        if (onChange) onChange(event);
    };

    return (
        <textarea ref={ref} id={id} value={value} onChange={handleChange} onKeyDown={onKeyDown} placeholder={placeholder} rows={rows}
                  disabled={disabled} autoFocus={autoFocus} spellCheck={!mono} maxLength={maxLength}
                  className={`textarea${mono ? " textarea--mono" : ""}${resize === "none" ? " textarea--fixed" : ""}`} />
    );
};
