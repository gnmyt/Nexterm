import "./styles.sass";
import Icon from "@mdi/react";

export const Button = ({onClick, text, icon, disabled, type, buttonType, title, className, spin, size}) => {
    return (
        <button className={"btn" + (type ? " type-" + type : "") + (!text ? " icon-only" : "") + (size ? " size-" + size : "") + (className ? " " + className : "")} onClick={onClick}
                disabled={disabled} type={buttonType} aria-label={!text ? title : undefined} title={!text ? title : undefined}>
            {icon ? <Icon path={icon} spin={spin ? 1 : 0} /> : null}
            {text && <h3>{text}</h3>}
        </button>
    );
}