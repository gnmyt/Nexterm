export const StatusBadge = ({ state, label }) => (
    <span className={`mon-status mon-state mon-state--${state}`}>
        <span className="mon-status__dot" />
        {label}
    </span>
);
