import "./styles.sass";
import { useCallback, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import { DialogProvider, DialogCancelButton } from "@/common/components/Dialog";
import { InheritanceContext } from "@/common/components/Field";
import { useScrollSpy } from "@/common/hooks/useScrollSpy.js";

const NO_INHERITANCE = { inheritedConfig: {}, overrides: [], onReset: null };
const FLASH_CLASS = "sd-section--flash";
const FLASH_DURATION = 900;

export const SectionedDialog = ({ ref, open, onClose, isDirty, disableClosing, icon, title, subtitle, sections, ready = true,
                                    inheritance = NO_INHERITANCE, onSubmit, submitLabel, submitDisabled, children }) => {
    const { t } = useTranslation();
    const [content, setContent] = useState(null);
    const sectionKeys = useMemo(() => (ready ? sections.map(section => section.key) : []), [ready, sections]);
    const [activeSection, scrollToKey] = useScrollSpy(content, sectionKeys, { offset: 4 });

    const scrollToSection = useCallback((key) => {
        const target = scrollToKey(key);
        if (!target) return;

        target.classList.remove(FLASH_CLASS);
        void target.offsetWidth;
        target.classList.add(FLASH_CLASS);
        setTimeout(() => target.classList.remove(FLASH_CLASS), FLASH_DURATION);

        target.querySelector("input:not([type=file]):not([type=checkbox])")?.focus({ preventScroll: true });
    }, [scrollToKey]);

    useImperativeHandle(ref, () => ({
        scrollTo: scrollToSection,
        scrollToTop: () => { if (content) content.scrollTop = 0; },
    }), [scrollToSection, content]);

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty} disableClosing={disableClosing}
                        className={`sectioned-dialog${sections.length > 1 ? "" : " sectioned-dialog--compact"}`}>
            <div className="sd">
                <header className="sd-header">
                    <div className="sd-header__icon"><Icon path={icon} /></div>
                    <div className="sd-header__text">
                        <h2>{title}</h2>
                        {subtitle && <span>{subtitle}</span>}
                    </div>
                </header>

                <div className="sd-body">
                    {sections.length > 1 && (
                        <nav className="sd-nav" aria-label={title}>
                            {sections.map(section => (
                                <button type="button" key={section.key}
                                        className={`sd-nav__item${activeSection === section.key ? " active" : ""}`}
                                        onClick={() => scrollToSection(section.key)}>
                                    <Icon path={section.icon} />
                                    <span>{t(section.label)}</span>
                                </button>
                            ))}
                        </nav>
                    )}

                    <InheritanceContext.Provider value={inheritance}>
                        <form className="sd-content" ref={setContent} onSubmit={(e) => e.preventDefault()} autoComplete="on">
                            {ready && children}
                            <div className="sd-content__tail" aria-hidden="true" />
                        </form>
                    </InheritanceContext.Provider>
                </div>

                <footer className="sd-footer">
                    <DialogCancelButton />
                    <Button text={submitLabel} onClick={onSubmit} disabled={submitDisabled} />
                </footer>
            </div>
        </DialogProvider>
    );
};
