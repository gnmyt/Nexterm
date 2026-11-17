import { useEffect, useMemo, useState } from "react";
import { mdiShieldAccount, mdiAccountKeyOutline, mdiShieldCrownOutline, mdiShieldKeyOutline, mdiEarth } from "@mdi/js";
import { getRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useUnsavedChanges } from "@/common/hooks/useUnsavedChanges.js";
import SectionedDialog, { SectionBlock, SettingRow } from "@/common/components/SectionedDialog";
import PermissionMatrix from "@/common/components/PermissionMatrix";
import AccessPolicyEditor from "../AccessPolicyEditor";
import { useTranslation } from "react-i18next";
import { getFullName } from "@/common/utils/avatar.js";

const EMPTY_POLICY = { ipMode: "disabled", ipRules: [], engineMode: "disabled", engineIds: [] };

const SECTIONS = [
    { key: "roles", label: "settings.permissions.rolesTab", icon: mdiShieldAccount },
    { key: "overrides", label: "settings.permissions.overridesTab", icon: mdiAccountKeyOutline },
    { key: "access", label: "settings.permissions.accessTab", icon: mdiEarth },
];

const normalizePolicy = (policy = EMPTY_POLICY) => ({
    ipMode: policy.ipMode,
    ipRules: [...(policy.ipRules || [])].sort(),
    engineMode: policy.engineMode,
    engineIds: [...(policy.engineIds || [])].map(String).sort(),
});

const normalizeDraft = ({ groupIds, overrides, accessPolicy }) => ({
    groupIds: [...groupIds].sort(),
    overrides: Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== "neutral")),
    accessPolicy: normalizePolicy(accessPolicy),
});

export const UserPermissionsDialog = ({ open, onClose, accountId, groups = [], catalog, onSaved, initialTab = "roles" }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [data, setData] = useState(null);
    const [groupIds, setGroupIds] = useState([]);
    const [overrides, setOverrides] = useState({});
    const [accessPolicy, setAccessPolicy] = useState(EMPTY_POLICY);
    const [engines, setEngines] = useState([]);
    const [saving, setSaving] = useState(false);

    const draft = useMemo(() => ({ groupIds, overrides, accessPolicy }), [groupIds, overrides, accessPolicy]);
    const { isDirty, markClean, reset: resetDirty } = useUnsavedChanges(draft, { normalize: normalizeDraft });

    useEffect(() => {
        if (!open || !accountId) return;
        let cancelled = false;

        setData(null);
        resetDirty();
        getRequest(`permissions/users/${accountId}`).then((res) => {
            if (cancelled) return;
            const initial = {
                groupIds: res.groupIds || [],
                overrides: res.overrides || {},
                accessPolicy: res.accessPolicy || EMPTY_POLICY,
            };
            setData(res);
            setGroupIds(initial.groupIds);
            setOverrides(initial.overrides);
            setAccessPolicy(initial.accessPolicy);
            markClean(initial);
        }).catch(() => {
            if (!cancelled) sendToast("Error", t("settings.permissions.loadError"));
        });

        getRequest("permissions/access-engines")
            .then((list) => { if (!cancelled) setEngines(list || []); })
            .catch(() => { if (!cancelled) setEngines([]); });

        return () => { cancelled = true; };
    }, [open, accountId]);

    const setGroup = (id, enabled) =>
        setGroupIds((prev) => (enabled ? [...prev.filter((g) => g !== id), id] : prev.filter((g) => g !== id)));

    const setOverride = (perm, value) =>
        setOverrides((prev) => ({ ...prev, [perm]: value }));

    const save = async () => {
        setSaving(true);
        try {
            // Access policy first: if its validation fails, groups/overrides stay untouched.
            await putRequest(`permissions/users/${accountId}/access`, accessPolicy);
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
        <SectionedDialog open={open} onClose={onClose} isDirty={isDirty} icon={mdiShieldKeyOutline}
                         title={t("settings.permissions.managePermissions")}
                         subtitle={data ? [getFullName(data), `@${data.username}`].filter(Boolean).join(" ") : undefined}
                         sections={SECTIONS} ready={!!data} initialSection={initialTab}
                         onSubmit={save} submitDisabled={saving || !data}
                         submitLabel={saving ? t("common.actions.saving") : t("common.actions.save")}>
            <SectionBlock id="roles" icon={mdiShieldAccount} title={t("settings.permissions.rolesTab")}>
                {assignableGroups.length === 0
                    ? <p className="sd-muted">{t("settings.permissions.noAssignableRoles")}</p>
                    : (
                        <div className="sd-settings">
                            {assignableGroups.map((group) => (
                                <SettingRow key={group.id} id={`role-${group.id}`} label={group.name} iconColor={group.color}
                                            icon={group.isAdmin ? mdiShieldCrownOutline : mdiShieldAccount}
                                            checked={groupIds.includes(group.id)}
                                            onChange={(enabled) => setGroup(group.id, enabled)} />
                            ))}
                        </div>
                    )}
            </SectionBlock>

            <SectionBlock id="overrides" icon={mdiAccountKeyOutline} title={t("settings.permissions.overridesTab")}>
                <PermissionMatrix catalog={catalog} values={overrides} onChange={setOverride} />
            </SectionBlock>

            <SectionBlock id="access" icon={mdiEarth} title={t("settings.permissions.accessTab")}>
                <AccessPolicyEditor value={accessPolicy} onChange={setAccessPolicy} engines={engines}
                                    inheritedRestricted={Boolean(data?.inheritedRestricted)} />
            </SectionBlock>
        </SectionedDialog>
    );
};
