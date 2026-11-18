import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose, mdiAlertCircleOutline } from "@mdi/js";
import "./styles.sass";
import Button from "@/common/components/Button";

const DialogContext = createContext({});

const UnsavedChangesGuard = ({ onKeep, onDiscard, guardRef }) => {
    const { t } = useTranslation();
    return (
        <div className="dialog-guard" role="alert" ref={guardRef}>
            <span className="dialog-guard__icon"><Icon path={mdiAlertCircleOutline} /></span>
            <div className="dialog-guard__text">
                <strong>{t("common.unsavedChanges.title")}</strong>
                <span>{t("common.unsavedChanges.text")}</span>
            </div>
            <div className="dialog-guard__actions">
                <Button type="secondary" size="small" text={t("common.unsavedChanges.keepEditing")} onClick={onKeep} />
                <Button type="danger" size="small" text={t("common.actions.discard")} onClick={onDiscard} />
            </div>
        </div>
    );
};

export const DialogCancelButton = ({ text, type = "secondary", ...props }) => {
    const { t } = useTranslation();
    const requestClose = useContext(DialogContext);
    return <Button type={type} buttonType="button" text={text ?? t("common.actions.cancel")} {...props} onClick={requestClose} />;
};

export const DialogProvider = ({ disableClosing, open, children, onClose, isDirty, className, portalTarget }) => {
    const areaRef = useRef();
    const ref = useRef();
    const guardRef = useRef();

    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showGuard, setShowGuard] = useState(false);

    const closeInner = useCallback(() => {
        setShowGuard(false);
        setIsClosing(true);
    }, []);

    const nudge = useCallback(() => {
        const el = ref.current;
        if (!el?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        const offsets = [0, -2, 3, -4, 4, -4, 4, -4, 3, -2, 0];
        el.animate(offsets.map(x => ({ transform: `translateX(${x}px)` })),
            { duration: 400, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" });
    }, []);

    const tryClose = useCallback(() => {
        if (disableClosing) return;

        const dirty = typeof isDirty === "function" ? isDirty() : isDirty;
        if (dirty) {
            setShowGuard(true);
            nudge();
            return;
        }
        closeInner();
    }, [disableClosing, isDirty, closeInner, nudge]);

    const keepEditing = useCallback(() => setShowGuard(false), []);

    useEffect(() => {
        if (!showGuard) return;
        const el = ref.current;
        if (!el) return;
        const onEdit = () => setShowGuard(false);
        el.addEventListener("input", onEdit, true);
        return () => el.removeEventListener("input", onEdit, true);
    }, [showGuard]);

    useEffect(() => {
        const handleClick = (event) => {
            const isInsideDialog = ref.current?.contains(event.target) || guardRef.current?.contains(event.target);
            const isInsidePortal = !!document.getElementById("select-box-portal")?.contains(event.target)
                || !!event.target.closest(".select-box__options, .icon-chooser__dropdown");

            if (!isInsideDialog && !isInsidePortal) {
                tryClose();
            }
        };

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [ref, tryClose]);

    useEffect(() => {
        if (!open || disableClosing) return;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                if (document.querySelector(".icon-chooser__dropdown.open, .select-box__options.open")) return;
                event.preventDefault();
                if (showGuard) {
                    setShowGuard(false);
                } else {
                    tryClose();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, disableClosing, tryClose, showGuard]);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            setIsClosing(false);
            setShowGuard(false);
        } else if (!isClosing) {
            closeInner();
        }
    }, [open]);

    const handleAnimationEnd = (event) => {
        if (event.target !== ref.current) return;
        if (isClosing) {
            setIsVisible(false);
            setIsClosing(false);
            if (onClose) onClose();
        }
    };

    const dialogContent = isVisible ? (
        <div className={`dialog-area ${isClosing ? "dialog-area-hidden" : ""}`} ref={areaRef}>
            <div className={`dialog${className ? " " + className : ""} ${isClosing ? "dialog-hidden" : ""}`}
                 ref={ref} onAnimationEnd={handleAnimationEnd}>
                {!disableClosing && (
                    <button className="dialog-close-btn" onClick={tryClose} aria-label="Close dialog">
                        <Icon path={mdiClose} size={0.9} />
                    </button>
                )}
                {children}
            </div>
            {showGuard && <UnsavedChangesGuard onKeep={keepEditing} onDiscard={closeInner} guardRef={guardRef} />}
        </div>
    ) : null;

    return (
        <DialogContext.Provider value={tryClose}>
            {createPortal(dialogContent, portalTarget || document.body)}
        </DialogContext.Provider>
    );
};
