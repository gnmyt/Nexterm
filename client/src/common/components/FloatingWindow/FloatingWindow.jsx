import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiWindowMaximize, mdiWindowRestore, mdiClose } from "@mdi/js";
import { useWindowControls } from "@/common/hooks/useWindowControls.js";
import ResizeHandle from "@/common/components/ResizeHandle";
import "./styles.sass";

export const FloatingWindowAction = ({ className = "", title, ...props }) => (
    <button type="button" className={`floating-window__action${className ? " " + className : ""}`}
            {...props} aria-label={props["aria-label"] || title} />
);

export const FloatingWindow = ({
    className = "", icon, title, titleExtra, actions, onClose, initialSize, children,
}) => {
    const { t } = useTranslation();
    const {
        windowRef, headerRef, isMaximized, focusWindow, handleMouseDown, handleResizeStart,
        toggleMaximize, getWindowStyle, getWindowClasses,
    } = useWindowControls(initialSize);

    return createPortal(
        <div ref={windowRef} role="dialog" aria-modal="false" aria-label={title}
             className={`${getWindowClasses("floating-window")}${className ? " " + className : ""}`}
             style={getWindowStyle()} onMouseDownCapture={focusWindow}
             onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
            <div ref={headerRef} className="floating-window__header" onMouseDown={handleMouseDown}>
                <div className="floating-window__title">
                    {icon && <Icon path={icon} />}
                    <h2>{title}</h2>
                    {titleExtra}
                </div>
                <div className="floating-window__actions">
                    {actions}
                    <FloatingWindowAction onClick={toggleMaximize}
                            title={isMaximized ? t("common.restore") : t("common.maximize")}>
                        <Icon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} />
                    </FloatingWindowAction>
                    <FloatingWindowAction className="floating-window__action--close"
                            onClick={onClose} title={t("common.close")}>
                        <Icon path={mdiClose} />
                    </FloatingWindowAction>
                </div>
            </div>

            {children}

            {!isMaximized && <ResizeHandle onMouseDown={handleResizeStart} />}
        </div>,
        document.body,
    );
};
