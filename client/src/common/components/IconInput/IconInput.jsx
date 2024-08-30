import "./styles.sass";
import Icon from "@mdi/react";

export const IconInput = ({ type, id, name, required, icon, placeholder, customClass,
                              autoComplete, value, setValue, onChange, onBlur }) => {
    return (
        <div className="input-container">
            <Icon path={icon} className="input-icon" />
            <input type={type} id={id} name={name} required={required} className={"input" + (customClass ? customClass : "")}
                     placeholder={placeholder} autoComplete={autoComplete} onInput={onChange}
                   onBlur={onBlur}
                   value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
    );
};
