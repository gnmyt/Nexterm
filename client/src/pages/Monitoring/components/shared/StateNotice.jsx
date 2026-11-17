import Icon from "@mdi/react";

export const StateNotice = ({ state, icon, title, message, meta }) => (
    <div className={`mon-notice mon-state mon-state--${state}`} role={state === "error" || state === "offline" ? "alert" : "status"}>
        <div className="mon-notice__icon"><Icon path={icon} /></div>
        <div className="mon-notice__body">
            <h4>{title}</h4>
            <p>{message}</p>
            {meta && <span className="mon-notice__meta">{meta}</span>}
        </div>
    </div>
);
