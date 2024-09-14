import "./styles.sass";
import Icon from "@mdi/react";

export const Button = ({onClick, text, icon, disabled, type}) => {
    return (
        <button className={"btn" + (type ? " type-" + type : "")} onClick={onClick} disabled={disabled}>
            {icon ? <Icon path={icon} /> : null}
            <h3>{text}</h3>
        </button>
    );
}