import "./styles.sass";

export const Page = ({ children, className }) => (
    <div className={`page${className ? " " + className : ""}`}>{children}</div>
);

export const PageToolbar = ({ children, className }) => (
    <div className={`page-toolbar${className ? " " + className : ""}`}>{children}</div>
);

export const PageContent = ({ children, className, flush = false }) => (
    <div className={`page-content${flush ? " page-content--flush" : ""}${className ? " " + className : ""}`}>
        {children}
    </div>
);
