import "./styles.sass";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteRequest, getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { getProviderIcon } from "@/common/utils/iconUtils";
import Icon from "@mdi/react";
import { mdiPencil, mdiPlus, mdiTrashCan, mdiLock, mdiServer } from "@mdi/js";
import ProviderDialog from "./components/ProviderDialog";
import LDAPProviderDialog from "./components/LDAPProviderDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";

export const Authentication = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [providers, setProviders] = useState([]);
    const [ldapProviders, setLdapProviders] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [ldapDialogOpen, setLdapDialogOpen] = useState(false);
    const [editProvider, setEditProvider] = useState(null);
    const [editLdapProvider, setEditLdapProvider] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState(null);
    const [selectedProviderType, setSelectedProviderType] = useState(null);

    const loadProviders = async () => {
        try {
            const response = await getRequest("auth/providers/admin");
            setProviders(response.oidc || []);
            setLdapProviders(response.ldap || []);
        } catch (error) {
            console.error("Error loading providers:", error);
        }
    };

    const handleDelete = async () => {
        try {
            const endpoint = `auth/providers/admin/${selectedProviderType}/${selectedProviderId}`;
            await deleteRequest(endpoint);
            await loadProviders();
            setDeleteDialogOpen(false);
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.authentication.errors.deleteProvider"));
        }
    };

    const toggleProvider = async (providerId, enabled, type = "oidc") => {
        try {
            const endpoint = `auth/providers/admin/${type}/${providerId}`;
            await patchRequest(endpoint, { enabled });
            await loadProviders();
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.authentication.errors.toggleProvider"));
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    return (
        <div className="authentication-page">
            <div className="auth-header">
                <h2>{t("settings.authentication.title", { count: providers.length + ldapProviders.length })}</h2>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button onClick={() => setLdapDialogOpen(true)} text={t("settings.authentication.addLdapProvider")} icon={mdiServer} type="secondary" />
                    <Button onClick={() => setCreateDialogOpen(true)} text={t("settings.authentication.addProvider")} icon={mdiPlus} />
                </div>
            </div>

            <div className="vertical-list">
                {providers.map(provider => (
                    <div key={`oidc-${provider.id}`} className="item">
                        <div className="left-section">
                            <div className={`icon ${provider.isInternal ? "warning" : "primary"}`}>
                                <Icon path={provider.isInternal ? mdiLock : getProviderIcon(provider)} />
                            </div>
                            <div className="details">
                                <h3>
                                    {provider.isInternal ? t("settings.authentication.internalProviderName") : provider.name}
                                    {!!provider.isInternal && (
                                        <span className="system-badge">{t("settings.authentication.system")}</span>
                                    )}
                                </h3>
                                <p>{provider.isInternal ? t("settings.authentication.systemDescription") : provider.issuer}</p>
                            </div>
                        </div>

                        <div className="right-section">
                            <ToggleSwitch 
                                checked={provider.enabled}
                                onChange={(checked) => toggleProvider(provider.id, checked, "oidc")}
                                id={`provider-toggle-${provider.id}`}
                            />

                            {!provider.isInternal && (
                                <>
                                    <Icon 
                                        path={mdiPencil} 
                                        className="action-icon"
                                        onClick={() => {
                                            setEditProvider(provider);
                                            setCreateDialogOpen(true);
                                        }}
                                    />
                                    <Icon 
                                        path={mdiTrashCan} 
                                        className="action-icon danger"
                                        onClick={() => {
                                            setSelectedProviderId(provider.id);
                                            setSelectedProviderType("oidc");
                                            setDeleteDialogOpen(true);
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                ))}

                {ldapProviders.map(provider => (
                    <div key={`ldap-${provider.id}`} className="item">
                        <div className="left-section">
                            <div className="icon primary">
                                <Icon path={mdiServer} />
                            </div>
                            <div className="details">
                                <h3>
                                    {provider.name}
                                    <span className="system-badge">LDAP</span>
                                </h3>
                                <p>{provider.host}:{provider.port}</p>
                            </div>
                        </div>

                        <div className="right-section">
                            <ToggleSwitch 
                                checked={provider.enabled}
                                onChange={(checked) => toggleProvider(provider.id, checked, "ldap")}
                                id={`ldap-toggle-${provider.id}`}
                            />

                            <Icon 
                                path={mdiPencil} 
                                className="action-icon"
                                onClick={() => {
                                    setEditLdapProvider(provider);
                                    setLdapDialogOpen(true);
                                }}
                            />
                            <Icon 
                                path={mdiTrashCan} 
                                className="action-icon danger"
                                onClick={() => {
                                    setSelectedProviderId(provider.id);
                                    setSelectedProviderType("ldap");
                                    setDeleteDialogOpen(true);
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <ProviderDialog open={createDialogOpen} provider={editProvider}
                onClose={() => {
                    setCreateDialogOpen(false);
                    setEditProvider(null);
                }}
                onSave={loadProviders}
            />

            <LDAPProviderDialog open={ldapDialogOpen} provider={editLdapProvider}
                onClose={() => {
                    setLdapDialogOpen(false);
                    setEditLdapProvider(null);
                }}
                onSave={loadProviders}
            />

            <ActionConfirmDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                text={t("settings.authentication.deleteConfirm")}
                onConfirm={handleDelete}
            />
        </div>
    );
};