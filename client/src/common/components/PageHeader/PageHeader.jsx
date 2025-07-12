import "./styles.sass";
import Icon from "@mdi/react";

const PageHeader = ({ icon, title, subtitle, children, onBackClick, backIcon }) => {
    return (
        <div className="page-header">
            <div className="header-title">
                {onBackClick ? (
                    <div className="header-back" onClick={onBackClick}>
                        <Icon path={backIcon} />
                        <div>
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </div>
                    </div>
                ) : (
                    <>
                        <Icon path={icon} />
                        <div>
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
