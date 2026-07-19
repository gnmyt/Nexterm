import "./styles.sass";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import TriToggle from "@/common/components/TriToggle";
import Tooltip from "@/common/components/Tooltip";
import {
    mdiAccountGroup, mdiShieldKeyOutline, mdiDomain, mdiCogOutline,
    mdiAccountMultipleOutline, mdiServerOutline, mdiShieldCheckOutline, mdiCheckCircle, mdiAlertOutline,
    mdiConsoleNetworkOutline, mdiFolderNetworkOutline, mdiMonitorShare,
} from "@mdi/js";

const ICONS = {
    mdiAccountGroup, mdiShieldKeyOutline, mdiDomain, mdiCogOutline,
    mdiAccountMultipleOutline, mdiServerOutline, mdiShieldCheckOutline,
    mdiConsoleNetworkOutline, mdiFolderNetworkOutline, mdiMonitorShare,
};

export const PermissionMatrix = ({ catalog, values = {}, onChange, disabled = false, readOnly = false, granted = [], inherited = null }) => {
    const { t } = useTranslation();

    if (!catalog) return null;

    const grantedSet = new Set(granted);
    const inheritedSet = inherited && new Set(inherited);
    const byCategory = (categoryKey) => catalog.permissions.filter((p) => p.category === categoryKey);

    return (
        <div className="permission-matrix">
            {catalog.categories.map((category) => {
                const perms = byCategory(category.key);
                if (!perms.length) return null;

                return (
                    <div className="perm-category" key={category.key}>
                        <div className="category-header">
                            {ICONS[category.icon] && <Icon path={ICONS[category.icon]} />}
                            <span>{category.label}</span>
                        </div>
                        <div className="perm-rows">
                            {perms.map((perm) => (
                                <div className={`perm-row ${perm.dangerous ? "dangerous" : ""}`} key={perm.id}>
                                    <div className="perm-info">
                                        <span className="perm-label">
                                            {perm.label}
                                            {perm.dangerous && (
                                                <Tooltip text={t("settings.permissions.dangerousHint")}>
                                                    <Icon path={mdiAlertOutline} className="danger-icon" />
                                                </Tooltip>
                                            )}
                                        </span>
                                        <span className="perm-description">{perm.description}</span>
                                    </div>
                                    {readOnly ? (
                                        <span className={`perm-effective ${grantedSet.has(perm.id) ? "on" : "off"}`}>
                                            {grantedSet.has(perm.id) && <Icon path={mdiCheckCircle} />}
                                        </span>
                                    ) : (
                                        <div className="perm-control">
                                            <TriToggle
                                                value={values[perm.id] || "neutral"}
                                                disabled={disabled}
                                                inherited={inheritedSet ? (inheritedSet.has(perm.id) ? "allow" : "deny") : undefined}
                                                inheritedHint={inheritedSet ? t(inheritedSet.has(perm.id)
                                                    ? "settings.permissions.inheritsAllow"
                                                    : "settings.permissions.inheritsDeny") : undefined}
                                                onChange={(value) => onChange && onChange(perm.id, value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};