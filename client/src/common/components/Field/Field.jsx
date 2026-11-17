import "./styles.sass";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiRestore } from "@mdi/js";

export const InheritanceContext = createContext({ inheritedConfig: {}, overrides: [], onReset: null, dimUnset: false, resetLabel: null });

const useInheritance = (configKey) => {
    const { inheritedConfig, overrides, onReset, dimUnset, resetLabel } = useContext(InheritanceContext);
    const overridden = !!configKey && overrides.includes(configKey);
    const inherited = !!configKey && !overridden && (dimUnset || Object.hasOwn(inheritedConfig, configKey));
    return { inherited, overridden, resetLabel, reset: () => onReset?.(configKey) };
};

export const InheritanceReset = ({ configKey }) => {
    const { t } = useTranslation();
    const { overridden, reset, resetLabel } = useInheritance(configKey);
    if (!overridden) return null;
    const label = resetLabel || t("servers.dialog.useInherited");
    return (
        <button type="button" className="form-field-reset" title={label} aria-label={label}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); reset(); }}>
            <Icon path={mdiRestore} />
            <span>{t("servers.dialog.reset")}</span>
        </button>
    );
};

export const useInheritedClass = (configKey) => (useInheritance(configKey).inherited ? " form-field-inherited" : "");

export const Field = ({ label, htmlFor, children, hint, className, configKey }) => {
    const inheritedClass = useInheritedClass(configKey);
    return (
        <div className={`form-field${className ? " " + className : ""}${inheritedClass}`}>
            {label && (
                <div className="form-field__label">
                    <label htmlFor={htmlFor}>{label}</label>
                    <InheritanceReset configKey={configKey} />
                </div>
            )}
            {children}
            {hint && <p className="form-field__hint">{hint}</p>}
        </div>
    );
};
