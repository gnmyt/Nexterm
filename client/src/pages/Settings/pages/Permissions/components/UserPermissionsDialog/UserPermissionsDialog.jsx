import "./styles.sass";
import { useEffect, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import { mdiShieldAccount, mdiAccountKeyOutline, mdiShieldCrownOutline } from "@mdi/js";
import { getRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import TabSwitcher from "@/common/components/TabSwitcher";
import Checkbox from "@/common/components/Checkbox";
import PermissionMatrix from "@/common/components/PermissionMatrix";
import { useTranslation } from "react-i18next";

export const UserPermissionsDialog = ({ open, onClose, accountId, groups = [], catalog, onSaved }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [data, setData] = useState(null);
    const [groupIds, setGroupIds] = useState([]);
    const [overrides, setOverrides] = useState({});
    const [tab, setTab] = useState("roles");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !accountId) return;
        setTab("roles");
        getRequest(`permissions/users/${accountId}`).then((res) => {
            setData(res);
            setGroupIds(res.groupIds || []);
            setOverrides(res.overrides || {});
        }).catch(() => sendToast("Error", t("settings.permissions.loadError")));
    }, [open, accountId]);

    const toggleGroup = (id) =>
        setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

    const setOverride = (perm, value) =>
        setOverrides((prev) => ({ ...prev, [perm]: value }));

    const save = async () => {
        setSaving(true);
        try {
            await Promise.all([
                putRequest(`permissions/users/${accountId}/groups`, { groupIds }),
                putRequest(`permissions/users/${accountId}/permissions`, { permissions: overrides }),
            ]);
            sendToast("Success", t("settings.permissions.userSaved"));
            onSaved?.();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        } finally {
            setSaving(false);
        }
    };

    const assignableGroups = groups.filter((g) => !g.isDefault);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="user-permissions-dialog">
                <div className="upd-header">
                    <h2>{t("settings.permissions.managePermissions")}</h2>
                    {data && <p>{data.firstName} {data.lastName} <span>@{data.username}</span></p>}
                </div>

                <TabSwitcher
                    tabs={[
                        { key: "roles", label: t("settings.permissions.rolesTab"), icon: mdiShieldAccount },
                        { key: "overrides", label: t("settings.permissions.overridesTab"), icon: mdiAccountKeyOutline },
                    ]}
                    activeTab={tab}
                    onTabChange={setTab}
                    variant="flat"
                />

                <div className="upd-body">
                    {tab === "roles" && (
                        <div className="role-select-list">
                            {assignableGroups.length === 0 && (
                                <p className="empty">{t("settings.permissions.noAssignableRoles")}</p>
                            )}
                            {assignableGroups.map((group) => {
                                const selected = groupIds.includes(group.id);
                                return (
                                    <div
                                        key={group.id}
                                        className={`role-select-item ${selected ? "selected" : ""}`}
                                        onClick={() => toggleGroup(group.id)}
                                    >
                                        <span className="role-icon" style={{ backgroundColor: `${group.color}26`, color: group.color }}>
                                            <Icon path={group.isAdmin ? mdiShieldCrownOutline : mdiShieldAccount} />
                                        </span>
                                        <span className="role-name">{group.name}</span>
                                        <span className="role-check-wrap" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox checked={selected} onChange={() => toggleGroup(group.id)} id={`role-${group.id}`} />
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {tab === "overrides" && (
                        <PermissionMatrix catalog={catalog} values={overrides} onChange={setOverride} />
                    )}
                </div>

                <div className="upd-actions">
                    <Button text={t("common.actions.cancel")} type="secondary" onClick={onClose} />
                    <Button text={saving ? t("common.actions.saving") : t("common.actions.save")} onClick={save} disabled={saving} />
                </div>
            </div>
        </DialogProvider>
    );
};