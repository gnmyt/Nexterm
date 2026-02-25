import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import "./styles.sass";

export const DialogContext = createContext({});

export const DialogProvider = ({ disableClosing, open, children, onClose, isDirty }) => {
    const { t } = useTranslation();
    const areaRef = useRef();
    const ref = useRef();
    const confirmRef = useRef();
    const cancelBtnRef = useRef();

    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const closeInner = useCallback(() => {
        setShowConfirm(false);
        setIsClosing(true);
    }, []);

    const tryClose = useCallback(() => {
        if (disableClosing) return;
        
        const dirty = typeof isDirty === 'function' ? isDirty() : isDirty;
        if (dirty) {
            setShowConfirm(true);
            return;
        }
        closeInner();
    }, [disableClosing, isDirty, closeInner]);

    const handleConfirmClose = useCallback(() => {
        closeInner();
    }, [closeInner]);

    const handleCancelClose = useCallback(() => {
        setShowConfirm(false);
    }, []);

    // ----------- Focus Trap & Cancel auto-focus ----------- //
    useEffect(() => {
        if (!isVisible) return;

        if (showConfirm && cancelBtnRef.current) {
            cancelBtnRef.current.focus();
            // Add a custom class to force the focus ring
            cancelBtnRef.current.classList.add("focus-outline");
        } else if (ref.current) {
            // Focus first focusable element in the dialog
            const focusable = ref.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length) focusable[0].focus();
        }
    }, [isVisible, showConfirm]);

    const handleKeyDownTrap = (e) => {
        if (!isVisible) return;
        if (e.key !== "Tab") return;

        let dialogNode;
        if (showConfirm && confirmRef.current) {
            dialogNode = confirmRef.current;
        } else {
            dialogNode = ref.current;
        }
        if (!dialogNode) return;

        const focusable = dialogNode.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusableArray = Array.from(focusable).filter(el => !el.disabled && el.tabIndex !== -1);

        if (focusableArray.length === 0) return;

        const first = focusableArray[0];
        const last = focusableArray.at(-1);

        const focused = document.activeElement;
        const isShift = e.shiftKey;

        if (!isShift && focused === last) {
            e.preventDefault();
            first.focus();
        } else if (isShift && focused === first) {
            e.preventDefault();
            last.focus();
        }
    };
    // ----------------------------------------------------- //

    useEffect(() => {
        const handleClick = (event) => {
            if (showConfirm) {
                if (!confirmRef.current?.contains(event.target)) {
                    setShowConfirm(false);
                }
                return;
            }
            
            const isInsideDialog = ref.current?.contains(event.target);
            const isInsidePortal = !!document.getElementById('select-box-portal')?.contains(event.target)
                || !!event.target.closest('.icon-chooser__dropdown');
            
            if (!isInsideDialog && !isInsidePortal) {
                tryClose();
            }
        };

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [ref, tryClose, showConfirm]);

    useEffect(() => {
        if (!open || disableClosing) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (showConfirm) {
                    setShowConfirm(false);
                } else {
                    tryClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, disableClosing, tryClose, showConfirm]);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            setIsClosing(false);
            setShowConfirm(false);
        } else if (!isClosing) {
            closeInner();
        }
    }, [open]);

    const handleAnimationEnd = () => {
        if (isClosing) {
            setIsVisible(false);
            setIsClosing(false);
            if (onClose) onClose();
        }
    };

    const dialogContent = isVisible ? (
        <dialog className={`dialog-area ${isClosing ? "dialog-area-hidden" : ""}`} ref={areaRef} onKeyDown={handleKeyDownTrap} open={isVisible}>
            <div className={`dialog ${isClosing ? "dialog-hidden" : ""}`} ref={ref}
                onAnimationEnd={handleAnimationEnd}>
                {!disableClosing && (
                    <button className="dialog-close-btn" onClick={tryClose} aria-label="Close dialog">
                        <Icon path={mdiClose} size={0.9} />
                    </button>
                )}
                {children}
            </div>
            {showConfirm && (
                <div className="dialog-confirm-overlay">
                    <div className="dialog-confirm" ref={confirmRef}>
                        <h3>{t('common.confirmDialog.unsavedChangesTitle')}</h3>
                        <p>{t('common.confirmDialog.unsavedChangesText')}</p>
                        <div className="dialog-confirm-actions">
                            <button className="dialog-confirm-btn secondary" onClick={handleCancelClose} ref={cancelBtnRef}>
                                {t('common.actions.cancel')}
                            </button>
                            <button className="dialog-confirm-btn primary" onClick={handleConfirmClose}>
                                {t('common.actions.discard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </dialog>
    ) : null;

    return (
        <DialogContext.Provider value={closeInner}>
            {createPortal(dialogContent, document.body)}
        </DialogContext.Provider>
    );
};