import { useContext, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { Permission } from "@/common/utils/permissions.js";
import { deleteRequest, getRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { mdiPlus, mdiTrashCan, mdiPencil, mdiKey, mdiAccount, mdiDomain, mdiLinkOff } from "@mdi/js";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import IdentityDialog from "./components/IdentityDialog";
import "./styles.sass";
import { SettingsHeading } from "@/common/components/SettingsDialog/SettingsHeading.jsx";
import EmptyState from "@/common/components/EmptyState";

export const IdentityCard = ({ identity, onEdit, onDelete }) => {
    const { t } = useTranslation();
    
    const getIdentityTypeLabel = (type) => {
        if (type === "ssh") return t("settings.identities.dialog.authTypes.ssh");
        if (type === "both") return t("settings.identities.dialog.authTypes.both");
        if (type === "password-only") return t("settings.identities.dialog.authTypes.password-only");
        return t("settings.identities.dialog.authTypes.password");
    };
    
    return (
        <div className="identity-card">
            <div className="identity-info">
                <Icon path={mdiKey} className="identity-icon" />
                <div className="identity-details">
                    <h3>{identity.name}</h3>
                    <p className="identity-username">{identity.username || t("settings.identities.noUsername")}</p>
                    <div className="identity-tags">
                        <span className="identity-type">{getIdentityTypeLabel(identity.type)}</span>
                        {identity.inUse === false && (
                            <span className="identity-unused" title={t("settings.identities.notInUseHint")}>
                                <Icon path={mdiLinkOff} />
                                {t("settings.identities.notInUse")}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="identity-actions">
                <Button icon={mdiPencil} onClick={() => onEdit(identity)} title={t("settings.identities.editIdentity")} />
                <Button type="danger" icon={mdiTrashCan} onClick={() => onDelete(identity)} title={t("settings.identities.deleteIdentity")} />
            </div>
        </div>
    );
};

export const IdentitiesPage = () => {
    const { t } = useTranslation();
    const { identities, loadIdentities } = useContext(IdentityContext);
    const { hasPermission } = useContext(UserContext);
    const { sendToast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingIdentity, setEditingIdentity] = useState(null);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, identity: null });
    const [organizations, setOrganizations] = useState([]);
    const [selectedScope, setSelectedScope] = useState(null);

    useEffect(() => {
        loadIdentities();
        const fetchOrganizations = async () => {
            try {
                const orgs = await getRequest("organizations");
                setOrganizations(orgs || []);
            } catch (error) {
                console.error("Failed to load organizations", error);
            }
        };
        fetchOrganizations();
    }, []);

    const scopeOptions = useMemo(() => {
        const options = [
            { value: null, label: t("settings.identities.personal"), icon: mdiAccount },
        ];
        organizations.forEach(org => {
            options.push({ value: org.id, label: org.name, icon: mdiDomain });
        });
        return options;
    }, [organizations, t]);

    const filteredIdentities = useMemo(() => {
        const globalIdentities = (identities || []).filter(i => !i.entryId);
        if (selectedScope === null) {
            return globalIdentities.filter(i => i.scope === 'personal');
        }
        return globalIdentities.filter(i => i.scope === 'organization' && i.organizationId === selectedScope);
    }, [identities, selectedScope]);

    const handleCreateNew = () => {
        setEditingIdentity(null);
        setDialogOpen(true);
    };

    const handleEdit = (identity) => {
        setEditingIdentity(identity);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setEditingIdentity(null);
        loadIdentities();
    };

    const handleDeleteRequest = (identity) => {
        setDeleteConfirmDialog({ open: true, identity });
    };

    const handleDeleteConfirm = async () => {
        const identity = deleteConfirmDialog.identity;

        try {
            await deleteRequest(`identities/${identity.id}`);
            sendToast(t("common.success"), t("settings.identities.deleteSuccess"));
            loadIdentities();
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.identities.deleteError"));
        }

        setDeleteConfirmDialog({ open: false, identity: null });
    };

    return (
        <div className="identities-page">
            <div className="identities-section">
                <div className="section-header">
                    <div className="header-content">
                        <SettingsHeading>{t("settings.identities.title")}</SettingsHeading>
                        <p>{t("settings.identities.description")}</p>
                    </div>
                    <div className="header-actions">
                        {scopeOptions.length > 1 && (
                            <SelectBox
                                options={scopeOptions}
                                selected={selectedScope}
                                setSelected={setSelectedScope}
                            />
                        )}
                        {hasPermission(Permission.IDENTITIES_MANAGE) && (
                            <Button text={t("settings.identities.createIdentity")} icon={mdiPlus} onClick={handleCreateNew} />
                        )}
                    </div>
                </div>

                <div className="identities-grid">
                    {filteredIdentities.length > 0 ? (
                            filteredIdentities.map((identity) => <IdentityCard key={identity.id} identity={identity}
                                                                       onEdit={handleEdit}
                                                                       onDelete={handleDeleteRequest} />)
                        ) :
                        <EmptyState icon={mdiKey} title={t("settings.identities.noIdentities")}
                                    description={t("settings.identities.noIdentitiesDescription")} />
                    }
                </div>
            </div>

            <IdentityDialog 
                open={dialogOpen} 
                onClose={handleDialogClose} 
                identity={editingIdentity}
                organizationId={selectedScope}
            />

            <ActionConfirmDialog open={deleteConfirmDialog.open}
                                 setOpen={(open) => setDeleteConfirmDialog(prev => ({ ...prev, open }))}
                                 onConfirm={handleDeleteConfirm}
                                 text={t("settings.identities.deleteConfirm", { name: deleteConfirmDialog.identity?.name })}
            />
        </div>
    );
};
