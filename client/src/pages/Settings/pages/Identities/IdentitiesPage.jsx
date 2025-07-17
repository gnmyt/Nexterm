import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { mdiPlus, mdiTrashCan, mdiPencil, mdiKey } from "@mdi/js";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import IdentityDialog from "./components/IdentityDialog";
import "./styles.sass";

export const IdentityCard = ({ identity, onEdit, onDelete }) => {
    const { t } = useTranslation();
    
    return (
        <div className="identity-card">
            <div className="identity-info">
                <Icon path={mdiKey} className="identity-icon" />
                <div className="identity-details">
                    <h3>{identity.name}</h3>
                    <p className="identity-username">{identity.username || t("settings.identities.noUsername")}</p>
                    <span className="identity-type">{identity.type === "ssh" ? t("settings.identities.sshKey") : t("settings.identities.password")}</span>
                </div>
            </div>
            <div className="identity-actions">
                <button className="action-btn edit-btn" onClick={() => onEdit(identity)} title={t("settings.identities.editIdentity")}>
                    <Icon path={mdiPencil} size={0.8} />
                </button>
                <button className="action-btn delete-btn" onClick={() => onDelete(identity)} title={t("settings.identities.deleteIdentity")}>
                    <Icon path={mdiTrashCan} size={0.8} />
                </button>
            </div>
        </div>
    );
};

export const IdentitiesPage = () => {
    const { t } = useTranslation();
    const { identities, loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingIdentity, setEditingIdentity] = useState(null);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, identity: null });

    useEffect(() => {
        loadIdentities();
    }, []);

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
                        <h2>{t("settings.identities.title")}</h2>
                        <p>{t("settings.identities.description")}</p>
                    </div>
                    <Button text={t("settings.identities.createIdentity")} icon={mdiPlus} onClick={handleCreateNew} />
                </div>

                <div className="identities-grid">
                    {identities && identities.length > 0 ? (
                            identities.map((identity) => <IdentityCard key={identity.id} identity={identity}
                                                                       onEdit={handleEdit}
                                                                       onDelete={handleDeleteRequest} />)
                        ) :
                        <div className="no-identities">
                            <Icon path={mdiKey} />
                            <h2>{t("settings.identities.noIdentities")}</h2>
                            <p>{t("settings.identities.noIdentitiesDescription")}</p>
                        </div>
                    }
                </div>
            </div>

            <IdentityDialog open={dialogOpen} onClose={handleDialogClose} identity={editingIdentity} />

            <ActionConfirmDialog open={deleteConfirmDialog.open}
                                 setOpen={(open) => setDeleteConfirmDialog(prev => ({ ...prev, open }))}
                                 onConfirm={handleDeleteConfirm}
                                 text={t("settings.identities.deleteConfirm", { name: deleteConfirmDialog.identity?.name })}
            />
        </div>
    );
};
