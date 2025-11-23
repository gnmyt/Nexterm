import "./styles.sass";
import Icon from "@mdi/react";

const PageHeader = ({ icon, title, subtitle, children, onBackClick, backIcon }) => {
    return (
        <div className="page-header">
            <div className="header-left">
                {onBackClick ? (
                    <div className="header-back" onClick={onBackClick}>
                        <div className="header-icon">
                            <Icon path={backIcon} size={1} />
                        </div>
                        <div className="header-content">
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="header-icon">
                            <Icon path={icon} size={1} />
                        </div>
                        <div className="header-content">
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </div>
                    </>
                )}
            </div>

            {children && (
                <div className="header-actions">
                    {children}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
