import { useEffect, useState } from "react";
import { mdiAccountKeyOutline, mdiShieldKeyOutline } from "@mdi/js";
import { getRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useUnsavedChanges } from "@/common/hooks/useUnsavedChanges.js";
import SectionedDialog, { SectionBlock } from "@/common/components/SectionedDialog";
import PermissionMatrix from "@/common/components/PermissionMatrix";
import { useTranslation } from "react-i18next";

const SECTIONS = [{ key: "overrides", label: "settings.permissions.overridesTab", icon: mdiAccountKeyOutline }];

const normalizeOverrides = (overrides) =>
    Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== "neutral"));

export const MemberPermissionsDialog = ({ open, onClose, organizationId, member, onSaved }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [catalog, setCatalog] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [inherited, setInherited] = useState([]);
    const [saving, setSaving] = useState(false);

    const { isDirty, markClean, reset: resetDirty } = useUnsavedChanges(overrides, { normalize: normalizeOverrides });

    useEffect(() => {
        if (!open || !organizationId || !member) return;
        let cancelled = false;

        setCatalog(null);
        resetDirty();
        getRequest(`organizations/${organizationId}/members/${member.accountId}/permissions`)
            .then((res) => {
                if (cancelled) return;
                const initial = res.overrides || {};
                setCatalog(res.catalog);
                setOverrides(initial);
                setInherited(res.inherited || []);
                markClean(initial);
            })
            .catch(() => {
                if (!cancelled) sendToast("Error", t("settings.permissions.loadError"));
            });
        return () => { cancelled = true; };
    }, [open, organizationId, member]);

    const setOverride = (perm, value) => setOverrides((prev) => ({ ...prev, [perm]: value }));

    const save = async () => {
        setSaving(true);
        try {
            await putRequest(`organizations/${organizationId}/members/${member.accountId}/permissions`, { permissions: overrides });
            sendToast("Success", t("settings.permissions.userSaved"));
            onSaved?.();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SectionedDialog open={open} onClose={onClose} isDirty={isDirty} icon={mdiShieldKeyOutline}
                         title={t("settings.permissions.managePermissions")}
                         subtitle={member ? [member.name, member.username].filter(Boolean).join(" ") : undefined}
                         sections={SECTIONS} ready={!!catalog} onSubmit={save} submitDisabled={saving || !catalog}
                         submitLabel={saving ? t("common.actions.saving") : t("common.actions.save")}>
            <SectionBlock id="overrides" icon={mdiAccountKeyOutline} title={t("settings.permissions.overridesTab")}>
                <PermissionMatrix catalog={catalog} values={overrides} onChange={setOverride} inherited={inherited} />
            </SectionBlock>
        </SectionedDialog>
    );
};
