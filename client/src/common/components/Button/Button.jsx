import "./styles.sass";
import Icon from "@mdi/react";

export const Button = ({onClick, text, icon}) => {
    return (
        <button className="btn" onClick={onClick}>
            {icon ? <Icon path={icon} /> : null}
            <h3>{text}</h3>
        </button>
    );
}