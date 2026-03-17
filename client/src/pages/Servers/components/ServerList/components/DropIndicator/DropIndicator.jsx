import "./styles.sass";

export const DropIndicator = ({ show, placement }) => {
    if (!show) return null;
    
    return (
        <div className={`drop-indicator drop-indicator-${placement}`}>
            <div className="drop-line" />
        </div>
    );
};
