export const SectionHeading = ({ title, count, children }) => (
    <div className="mon-heading">
        <h3>{title}</h3>
        {count != null && <span className="mon-heading__count">{count}</span>}
        {children && <div className="mon-heading__action">{children}</div>}
    </div>
);
