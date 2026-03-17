import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import "./styles.sass";

export const Button = ({color = "primary", text, icon, onClick, disabled, size = "md", variant = "filled"}) => {
    return (
        <button
            className={`btn btn-${variant} btn-${color} btn-${size}`}
            onClick={onClick}
            disabled={disabled}
        >
            {icon && <FontAwesomeIcon icon={icon}/>}
            {text && <span>{text}</span>}
        </button>
    );
}