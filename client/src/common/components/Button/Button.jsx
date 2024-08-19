import "./styles.sass";

export const Button = ({onClick, text}) => {
    return (
        <button className="btn" onClick={onClick}>
            <h3>{text}</h3>
        </button>
    );
}