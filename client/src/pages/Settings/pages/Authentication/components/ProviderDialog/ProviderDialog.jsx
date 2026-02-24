import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import {
    mdiAccountMultiple,
    mdiCog,
    mdiDomain,
    mdiFormTextbox,
    mdiKey,
    mdiKeyChain,
    mdiLink,
} from "@mdi/js";
import Button from "@/common/components/Button";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";

export const ProviderDialog = ({ open, onClose, provider, onSave }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [issuer, setIssuer] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [redirectUri, setRedirectUri] = useState("");
    const [scope, setScope] = useState("openid profile");

    const [usernameAttr, setUsernameAttr] = useState("preferred_username");
    const [firstNameAttr, setFirstNameAttr] = useState("given_name");
    const [lastNameAttr, setLastNameAttr] = useState("family_name");
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (provider) {
            setName(provider.name);
            setIssuer(provider.issuer);
            setClientId(provider.clientId);
            setClientSecret("********");
            setRedirectUri(provider.redirectUri);
            setScope(provider.scope);
            setUsernameAttr(provider.usernameAttribute);
            setFirstNameAttr(provider.firstNameAttribute);
            setLastNameAttr(provider.lastNameAttribute);
        } else {
            setName("");
            setIssuer("");
            setClientId("");
            setClientSecret("");
            const baseUrl = getBaseUrl() || window.location.origin;
            setRedirectUri(baseUrl + "/api/auth/oidc/callback");
            setScope("openid profile");
            setUsernameAttr("preferred_username");
            setFirstNameAttr("given_name");
            setLastNameAttr("family_name");
        }
        setShowAdvanced(false);
    }, [provider, open]);

    const handleSubmit = async () => {
        try {
            const data = {
                name, issuer, clientId, redirectUri, scope,
                usernameAttribute: usernameAttr, firstNameAttribute: firstNameAttr, lastNameAttribute: lastNameAttr,
            };

            if (clientSecret && clientSecret !== "********") {
                data.clientSecret = clientSecret;
            }

            if (provider) {
                await patchRequest(`auth/providers/admin/oidc/${provider.id}`, data);
            } else {
                data.enabled = true; // New providers are enabled by default
                await putRequest("auth/providers/admin/oidc", data);
            }

            onSave();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t('settings.authentication.providerDialog.messages.saveFailed'));
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="provider-dialog">
                <h2>{provider ? t('settings.authentication.providerDialog.editTitle') : t('settings.authentication.providerDialog.createTitle')}</h2>

                <div className="form-group">
                    <label htmlFor="name">{t('settings.authentication.providerDialog.fields.displayName')}</label>
                    <Input icon={mdiFormTextbox} type="text" id="name"
                           placeholder={t('settings.authentication.providerDialog.fields.displayNamePlaceholder')} value={name} setValue={setName} />
                </div>

                <div className="form-group">
                    <label htmlFor="issuer">{t('settings.authentication.providerDialog.fields.issuerUrl')}</label>
                    <Input icon={mdiDomain} type="url" id="issuer"
                           placeholder={t('settings.authentication.providerDialog.fields.issuerUrlPlaceholder')} value={issuer} setValue={setIssuer} />
                </div>

                <div className="form-group">
                    <label htmlFor="clientId">{t('settings.authentication.providerDialog.fields.clientId')}</label>
                    <Input icon={mdiKey} type="text" id="clientId"
                           placeholder={t('settings.authentication.providerDialog.fields.clientIdPlaceholder')} value={clientId} setValue={setClientId} />
                </div>

                <div className="form-group">
                    <label htmlFor="clientSecret">{t('settings.authentication.providerDialog.fields.clientSecret')}</label>
                    <Input icon={mdiKeyChain} type="password" id="clientSecret"
                           placeholder={provider ? t('settings.authentication.providerDialog.fields.clientSecretPlaceholderEdit') : t('settings.authentication.providerDialog.fields.clientSecretPlaceholder')}
                           value={clientSecret} setValue={setClientSecret} />
                </div>

                <div className="form-group">
                    <label htmlFor="redirectUri">{t('settings.authentication.providerDialog.fields.redirectUri')}</label>
                    <Input icon={mdiLink} type="url" id="redirectUri"
                           placeholder={t('settings.authentication.providerDialog.fields.redirectUriPlaceholder')}
                           value={redirectUri} setValue={setRedirectUri} />
                </div>

                <div className="form-group">
                    <label htmlFor="scope">{t('settings.authentication.providerDialog.fields.scope')}</label>
                    <Input icon={mdiAccountMultiple} type="text" id="scope"
                           placeholder={t('settings.authentication.providerDialog.fields.scopePlaceholder')} value={scope} setValue={setScope} />
                </div>

                <div className="advanced-settings">
                    <Button type="secondary" icon={mdiCog} onClick={() => setShowAdvanced(!showAdvanced)}
                            text={showAdvanced ? t('settings.authentication.providerDialog.advanced.hide') : t('settings.authentication.providerDialog.advanced.show')} />

                    {showAdvanced && (
                        <div className="advanced-form">
                            <div className="form-group">
                                <label htmlFor="usernameAttr">{t('settings.authentication.providerDialog.fields.usernameAttribute')}</label>
                                <Input type="text" id="usernameAttr" icon={mdiAccountMultiple}
                                       placeholder={t('settings.authentication.providerDialog.fields.usernameAttributePlaceholder')} value={usernameAttr}
                                       setValue={setUsernameAttr} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="firstNameAttr">{t('settings.authentication.providerDialog.fields.firstNameAttribute')}</label>
                                <Input type="text" id="firstNameAttr" icon={mdiFormTextbox}
                                       placeholder={t('settings.authentication.providerDialog.fields.firstNameAttributePlaceholder')} value={firstNameAttr} setValue={setFirstNameAttr} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="lastNameAttr">{t('settings.authentication.providerDialog.fields.lastNameAttribute')}</label>
                                <Input type="text" id="lastNameAttr" icon={mdiFormTextbox}
                                       placeholder={t('settings.authentication.providerDialog.fields.lastNameAttributePlaceholder')} value={lastNameAttr} setValue={setLastNameAttr} />
                            </div>
                        </div>
                    )}
                </div>

                <Button text={provider ? t('settings.authentication.providerDialog.actions.saveChanges') : t('settings.authentication.providerDialog.actions.addProvider')} onClick={handleSubmit} />
            </div>
        </DialogProvider>
    );
};