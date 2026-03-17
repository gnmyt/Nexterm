import "./styles.sass";
import Icon from "@mdi/react";

export const IconInput = ({ type, id, name, required, icon, placeholder, customClass,
                              autoComplete, value, setValue, onChange, onBlur, onKeyDown, autoFocus, disabled }) => {
    const handleChange = (event) => {
        if (setValue) {
            setValue(event.target.value);
        }
        if (onChange) {
            onChange(event);
        }
    };

    return (
        <div className="input-container">
            <Icon path={icon} className="input-icon" />
            <input 
                type={type} 
                id={id} 
                name={name} 
                required={required} 
                className={"input" + (customClass ? " " + customClass : "")}
                placeholder={placeholder} 
                autoComplete={autoComplete} 
                onBlur={onBlur} 
                value={value} 
                onChange={handleChange}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
                disabled={disabled}
            />
        </div>
    );
};
