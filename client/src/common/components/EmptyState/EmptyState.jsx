import "./styles.sass";
import Icon from "@mdi/react";

export const EmptyState = ({ icon, title, description, children, compact = false, className }) => (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}${className ? " " + className : ""}`}>
        {icon && <div className="empty-state__icon"><Icon path={icon} /></div>}
        {title && <h3 className="empty-state__title">{title}</h3>}
        {description && <p className="empty-state__description">{description}</p>}
        {children && <div className="empty-state__actions">{children}</div>}
    </div>
);
