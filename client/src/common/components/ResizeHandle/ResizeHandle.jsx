import { useTranslation } from "react-i18next";
import "./styles.sass";

export const ResizeHandle = ({ onMouseDown, className = "" }) => {
    const { t } = useTranslation();

    return (
        <div className={`resize-handle${className ? ` ${className}` : ""}`} onMouseDown={onMouseDown}
             role="separator" aria-label={t("common.resize")}>
            <span className="resize-handle__grip" />
        </div>
    );
};
