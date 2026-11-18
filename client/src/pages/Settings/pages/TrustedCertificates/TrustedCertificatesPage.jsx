import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiAccount, mdiCertificateOutline, mdiCogOutline, mdiDomain, mdiKeyChainVariant, mdiTrashCan } from "@mdi/js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import EmptyState from "@/common/components/EmptyState";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { SettingsHeading } from "@/common/components/SettingsDialog/SettingsHeading.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { deleteRequest, getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import "@/pages/Settings/pages/Identities/styles.sass";
import "@/pages/Settings/pages/Monitoring/styles.sass";
import "./styles.sass";

const PERSONAL = "personal";
const SYSTEM = "system";

const TrustedCertificateCard = ({ record, onDelete }) => {
    const { t } = useTranslation();
    const isKey = record.kind === "ssh";

    return (
        <div className="identity-card">
            <div className="identity-info">
                <Icon path={isKey ? mdiKeyChainVariant : mdiCertificateOutline} className="identity-icon" />
                <div className="identity-details">
                    <h3>{record.host}:{record.port}</h3>
                    <p className="identity-username trusted-fingerprint">{record.fingerprint}</p>
                    <div className="identity-tags">
                        <span className="identity-type">
                            {t(isKey ? "settings.trustedCertificates.kinds.ssh" : "settings.trustedCertificates.kinds.tls")}
                        </span>
                    </div>
                </div>
            </div>
            {record.canManage && (
                <div className="identity-actions">
                    <Button type="danger" icon={mdiTrashCan} onClick={() => onDelete(record)}
                            title={t("settings.trustedCertificates.remove")} />
                </div>
            )}
        </div>
    );
};

export const TrustedCertificatesPage = () => {
    const { t } = useTranslation();
    const { user, login } = useContext(UserContext);
    const { sendToast } = useToast();

    const [records, setRecords] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [selectedScope, setSelectedScope] = useState(PERSONAL);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, record: null });
    const [ignoreWarnings, setIgnoreWarnings] = useState(user?.preferences?.security?.ignoreCertificateWarnings === true);

    const loadRecords = useCallback(async () => {
        try {
            setRecords(await getRequest("trusted-hosts/list") || []);
        } catch (error) {
            console.error("Failed to load trusted certificates", error);
        }
    }, []);

    useEffect(() => {
        loadRecords();
        getRequest("organizations").then((orgs) => setOrganizations(orgs || [])).catch(() => {});
    }, [loadRecords]);

    const scopeOptions = useMemo(() => {
        const options = [{ value: PERSONAL, label: t("settings.trustedCertificates.personal"), icon: mdiAccount }];
        organizations.forEach((organization) => options.push({ value: organization.id, label: organization.name, icon: mdiDomain }));
        if (records.some((record) => record.scope === SYSTEM)) {
            options.push({ value: SYSTEM, label: t("settings.trustedCertificates.system"), icon: mdiCogOutline });
        }
        return options;
    }, [organizations, records, t]);

    const visibleRecords = useMemo(() => records.filter((record) => {
        if (selectedScope === PERSONAL || selectedScope === SYSTEM) return record.scope === selectedScope;
        return record.scope === "organization" && record.organizationId === selectedScope;
    }), [records, selectedScope]);

    const handleDeleteConfirm = async () => {
        const { record } = deleteDialog;
        try {
            await deleteRequest(`trusted-hosts/${record.id}`);
            sendToast(t("common.success"), t("settings.trustedCertificates.removeSuccess"));
            loadRecords();
        } catch (error) {
            sendToast(t("common.error"), error?.error || error?.message || t("settings.trustedCertificates.removeError"));
        }
        setDeleteDialog({ open: false, record: null });
    };

    const handleIgnoreToggle = async (enabled) => {
        setIgnoreWarnings(enabled);
        try {
            await patchRequest("accounts/me/preferences", { security: { ignoreCertificateWarnings: enabled } });
            login?.();
        } catch (error) {
            setIgnoreWarnings(!enabled);
            sendToast(t("common.error"), error?.message || t("settings.trustedCertificates.ignore.error"));
        }
    };

    return (
        <div className="identities-page">
            <div className="identities-section">
                <div className="section-header">
                    <div className="header-content">
                        <SettingsHeading>{t("settings.trustedCertificates.title")}</SettingsHeading>
                        <p>{t("settings.trustedCertificates.description")}</p>
                    </div>
                    <div className="header-actions">
                        {scopeOptions.length > 1 && (
                            <SelectBox options={scopeOptions} selected={selectedScope} setSelected={setSelectedScope} />
                        )}
                    </div>
                </div>

                <div className="identities-grid">
                    {visibleRecords.length > 0
                        ? visibleRecords.map((record) => (
                            <TrustedCertificateCard key={record.id} record={record}
                                                    onDelete={(target) => setDeleteDialog({ open: true, record: target })} />
                        ))
                        : <EmptyState icon={mdiCertificateOutline} title={t("settings.trustedCertificates.empty")}
                                      description={t("settings.trustedCertificates.emptyDescription")} />}
                </div>
            </div>

            {selectedScope === PERSONAL && (
                <div className="setting-item">
                    <div className="setting-label">
                        <h4>{t("settings.trustedCertificates.ignore.title")}</h4>
                        <p>{t("settings.trustedCertificates.ignore.description")}</p>
                    </div>
                    <ToggleSwitch id="ignore-certificate-warnings" checked={ignoreWarnings} onChange={handleIgnoreToggle} />
                </div>
            )}

            <ActionConfirmDialog open={deleteDialog.open}
                                 setOpen={(open) => setDeleteDialog((previous) => ({ ...previous, open }))}
                                 onConfirm={handleDeleteConfirm}
                                 text={t("settings.trustedCertificates.removeConfirm", {
                                     endpoint: deleteDialog.record ? `${deleteDialog.record.host}:${deleteDialog.record.port}` : "",
                                 })} />
        </div>
    );
};
