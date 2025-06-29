import "./styles.sass";

export const ToggleSwitch = ({ checked, onChange, id, disabled = false }) => {
    const handleChange = (e) => {
        if (onChange) onChange(e.target.checked);
    };

    return (
        <div className={`toggle-switch ${checked ? "enabled" : ""} ${disabled ? "disabled" : ""}`}>
            <input type="checkbox" checked={checked} onChange={handleChange} disabled={disabled} id={id} />
            <label htmlFor={id} className="toggle-slider"></label>
        </div>
    );
};