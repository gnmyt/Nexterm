import { useContext, useEffect, useState } from "react";
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
    return (
        <div className="identity-card">
            <div className="identity-info">
                <Icon path={mdiKey} className="identity-icon" />
                <div className="identity-details">
                    <h3>{identity.name}</h3>
                    <p className="identity-username">{identity.username || "No username"}</p>
                    <span className="identity-type">{identity.type === "ssh" ? "SSH Key" : "Password"}</span>
                </div>
            </div>
            <div className="identity-actions">
                <button className="action-btn edit-btn" onClick={() => onEdit(identity)} title="Edit identity">
                    <Icon path={mdiPencil} size={0.8} />
                </button>
                <button className="action-btn delete-btn" onClick={() => onDelete(identity)} title="Delete identity">
                    <Icon path={mdiTrashCan} size={0.8} />
                </button>
            </div>
        </div>
    );
};

export const IdentitiesPage = () => {
    const { identities, loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingIdentity, setEditingIdentity] = useState(null);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, identity: null });

    useEffect(() => {
        loadIdentities();
    }, [loadIdentities]);

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
            sendToast("Success", "Identity deleted successfully");
            loadIdentities();
        } catch (error) {
            sendToast("Error", error.message || "Failed to delete identity");
        }

        setDeleteConfirmDialog({ open: false, identity: null });
    };

    return (
        <div className="identities-page">
            <div className="identities-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2>SSH Keys & Credentials</h2>
                        <p>Manage your SSH keys and login credentials for server connections</p>
                    </div>
                    <Button text="Create Identity" icon={mdiPlus} onClick={handleCreateNew} />
                </div>

                <div className="identities-grid">
                    {identities && identities.length > 0 ? (
                            identities.map((identity) => <IdentityCard key={identity.id} identity={identity}
                                                                       onEdit={handleEdit}
                                                                       onDelete={handleDeleteRequest} />)
                        ) :
                        <div className="no-identities">
                            <Icon path={mdiKey} />
                            <h2>No Identities Found</h2>
                            <p>Create your first identity to get started with server connections</p>
                        </div>
                    }
                </div>
            </div>

            <IdentityDialog open={dialogOpen} onClose={handleDialogClose} identity={editingIdentity} />

            <ActionConfirmDialog open={deleteConfirmDialog.open}
                                 setOpen={(open) => setDeleteConfirmDialog(prev => ({ ...prev, open }))}
                                 onConfirm={handleDeleteConfirm}
                                 text={`Are you sure you want to delete "${deleteConfirmDialog.identity?.name}"? This action cannot be undone and will remove this identity from all servers that use it.`}
            />
        </div>
    );
};
