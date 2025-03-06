import "./styles.sass";
import { useEffect, useState } from "react";
import { deleteRequest, getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import { mdiPencil, mdiPlus, mdiShieldAccountOutline, mdiTrashCan } from "@mdi/js";
import ProviderDialog from "./components/ProviderDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";

export const Authentication = () => {
    const [providers, setProviders] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editProvider, setEditProvider] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState(null);

    const loadProviders = async () => {
        try {
            const response = await getRequest("oidc/admin/providers");
            setProviders(response);
        } catch (error) {
            console.error("Error loading OIDC providers:", error);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteRequest(`oidc/admin/providers/${selectedProviderId}`);
            await loadProviders();
            setDeleteDialogOpen(false);
        } catch (error) {
            console.error("Error deleting provider:", error);
        }
    };

    const toggleProvider = async (providerId, enabled) => {
        try {
            await patchRequest(`oidc/admin/providers/${providerId}`, { enabled });
            await loadProviders();
        } catch (error) {
            console.error("Error toggling provider:", error);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    return (
        <div className="authentication-page">
            <div className="provider-title">
                <h2>{providers.length} Authentication Providers</h2>
                <Button onClick={() => setCreateDialogOpen(true)} text="Add Provider" icon={mdiPlus} />
            </div>

            {providers.map(provider => (
                <div key={provider.id} className="provider-item">
                    <div class="left-area">
                        <Icon path={mdiShieldAccountOutline} className="menu" size={1.5} />
                        <div className="provider-info">
                            <h2>{provider.name}</h2>
                            <p>{provider.issuer}</p>
                        </div>
                    </div>

                    <div className="provider-actions">
                        <label className="switch">
                            <input type="checkbox" checked={provider.enabled}
                                   onChange={() => toggleProvider(provider.id, !provider.enabled)} />
                            <span className="slider" />
                        </label>

                        <Icon path={mdiPencil} className="menu"
                            onClick={() => {
                                setEditProvider(provider);
                                setCreateDialogOpen(true);
                            }}
                        />
                        <Icon path={mdiTrashCan} className="menu delete-menu"
                            onClick={() => {
                                setSelectedProviderId(provider.id);
                                setDeleteDialogOpen(true);
                            }}
                        />
                    </div>
                </div>
            ))}

            <ProviderDialog open={createDialogOpen} provider={editProvider}
                onClose={() => {
                    setCreateDialogOpen(false);
                    setEditProvider(null);
                }}
                onSave={loadProviders}
            />

            <ActionConfirmDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                text="This will permanently delete this authentication provider."
                onConfirm={handleDelete}
            />
        </div>
    );
};