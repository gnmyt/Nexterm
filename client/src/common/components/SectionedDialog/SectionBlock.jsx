import Icon from "@mdi/react";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { InheritanceReset, useInheritedClass } from "@/common/components/Field";

export const SectionBlock = ({ id, icon, title, description, children, actions }) => (
    <section className="sd-section" data-section={id} id={`sd-section-${id}`}>
        <header className="sd-section__header">
            <div className="sd-section__heading">
                {icon && <Icon path={icon} className="sd-section__icon" />}
                <h3>{title}</h3>
            </div>
            {actions}
        </header>
        {description && <p className="sd-section__description">{description}</p>}
        <div className="sd-section__body">{children}</div>
    </section>
);

export const SettingRow = ({ id, icon, iconColor, label, description, checked, onChange, configKey }) => {
    const inheritedClass = useInheritedClass(configKey);
    return (
        <label className={`sd-setting${inheritedClass}`} htmlFor={id}>
            {icon && <Icon path={icon} className="sd-setting__icon" style={iconColor ? { color: iconColor } : undefined} />}
            <span className="sd-setting__text">
                <span className="sd-setting__label">{label}<InheritanceReset configKey={configKey} /></span>
                {description && <span className="sd-setting__description">{description}</span>}
            </span>
            <ToggleSwitch id={id} checked={checked} onChange={onChange} />
        </label>
    );
};
