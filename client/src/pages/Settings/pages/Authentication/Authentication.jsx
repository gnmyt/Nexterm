import "./styles.sass";
import { useEffect, useState } from "react";
import { deleteRequest, getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import Icon from "@mdi/react";
import { mdiPencil, mdiPlus, mdiShieldAccountOutline, mdiTrashCan, mdiLock } from "@mdi/js";
import ProviderDialog from "./components/ProviderDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";

export const Authentication = () => {
    const { sendToast } = useToast();
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
            sendToast("Error", error.message || "Error deleting provider");
        }
    };

    const toggleProvider = async (providerId, enabled) => {
        try {
            await patchRequest(`oidc/admin/providers/${providerId}`, { enabled });
            await loadProviders();
        } catch (error) {
            sendToast("Error", error.message || "Error toggling provider");
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
                    <div className="left-area">
                        <Icon path={provider.isInternal ? mdiLock : mdiShieldAccountOutline} className="menu" size={1.5} />
                        <div className="provider-info">
                            <h2>
                                {provider.name}
                                {provider.isInternal && <span className="internal-badge">System</span>}
                            </h2>
                            <p>{provider.isInternal ? "Username and password authentication" : provider.issuer}</p>
                        </div>
                    </div>

                    <div className="provider-actions">
                        <ToggleSwitch 
                            checked={provider.enabled}
                            onChange={(checked) => toggleProvider(provider.id, checked)}
                            id={`provider-toggle-${provider.id}`}
                        />

                        {!provider.isInternal && (
                            <>
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
                            </>
                        )}
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