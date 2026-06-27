import "./styles.sass";
import { useEffect, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { getRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import PermissionMatrix from "@/common/components/PermissionMatrix";
import { useTranslation } from "react-i18next";

export const MemberPermissionsDialog = ({ open, onClose, organizationId, member, onSaved }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [catalog, setCatalog] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [inherited, setInherited] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !organizationId || !member) return;
        getRequest(`organizations/${organizationId}/members/${member.accountId}/permissions`)
            .then((res) => {
                setCatalog(res.catalog);
                setOverrides(res.overrides || {});
                setInherited(res.inherited || []);
            })
            .catch(() => sendToast("Error", t("settings.permissions.loadError")));
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
        <DialogProvider open={open} onClose={onClose}>
            <div className="member-permissions-dialog">
                <div className="mpd-header">
                    <h2>{t("settings.permissions.managePermissions")}</h2>
                    {member && <p>{member.name} <span>{member.username}</span></p>}
                </div>

                <div className="mpd-body">
                    <PermissionMatrix catalog={catalog} values={overrides} onChange={setOverride} inherited={inherited} />
                </div>

                <div className="mpd-actions">
                    <Button text={t("common.actions.cancel")} type="secondary" onClick={onClose} />
                    <Button text={saving ? t("common.actions.saving") : t("common.actions.save")} onClick={save} disabled={saving} />
                </div>
            </div>
        </DialogProvider>
    );
};