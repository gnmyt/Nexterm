import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useEffect, useState } from "react";
import Input from "@/common/components/IconInput";
import {
    mdiAccountMultiple,
    mdiCog,
    mdiDomain,
    mdiEmail,
    mdiFormTextbox,
    mdiKey,
    mdiKeyChain,
    mdiLink,
} from "@mdi/js";
import Button from "@/common/components/Button";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";

export const ProviderDialog = ({ open, onClose, provider, onSave }) => {
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [issuer, setIssuer] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [redirectUri, setRedirectUri] = useState("");
    const [scope, setScope] = useState("openid profile email");

    const [emailAttr, setEmailAttr] = useState("email");
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
            setEmailAttr(provider.emailAttribute);
            setUsernameAttr(provider.usernameAttribute);
            setFirstNameAttr(provider.firstNameAttribute);
            setLastNameAttr(provider.lastNameAttribute);
        } else {
            setName("");
            setIssuer("");
            setClientId("");
            setClientSecret("");
            setRedirectUri(window.location.origin + "/api/oidc/callback");
            setScope("openid profile email");
            setEmailAttr("email");
            setUsernameAttr("preferred_username");
            setFirstNameAttr("given_name");
            setLastNameAttr("family_name");
        }
        setShowAdvanced(false);
    }, [provider, open]);

    const handleSubmit = async () => {
        try {
            const data = {
                name, issuer, clientId, redirectUri, scope, emailAttribute: emailAttr,
                usernameAttribute: usernameAttr, firstNameAttribute: firstNameAttr, lastNameAttribute: lastNameAttr,
            };

            if (clientSecret && clientSecret !== "********") {
                data.clientSecret = clientSecret;
            }

            if (provider) {
                await patchRequest(`oidc/admin/providers/${provider.id}`, data);
            } else {
                await putRequest("oidc/admin/providers", data);
            }

            onSave();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || "Failed to save provider");
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="provider-dialog">
                <h2>{provider ? "Edit" : "Add"} Authentication Provider</h2>

                <div className="form-group">
                    <label htmlFor="name">Display Name</label>
                    <Input icon={mdiFormTextbox} type="text" id="name"
                           placeholder="e.g. Company SSO" value={name} setValue={setName} />
                </div>

                <div className="form-group">
                    <label htmlFor="issuer">Issuer URL</label>
                    <Input icon={mdiDomain} type="url" id="issuer"
                           placeholder="https://auth.company.com" value={issuer} setValue={setIssuer} />
                </div>

                <div className="form-group">
                    <label htmlFor="clientId">Client ID</label>
                    <Input icon={mdiKey} type="text" id="clientId"
                           placeholder="Client ID" value={clientId} setValue={setClientId} />
                </div>

                <div className="form-group">
                    <label htmlFor="clientSecret">Client Secret</label>
                    <Input icon={mdiKeyChain} type="password" id="clientSecret"
                           placeholder={provider ? "Leave blank to keep existing" : "Client Secret"}
                           value={clientSecret} setValue={setClientSecret} />
                </div>

                <div className="form-group">
                    <label htmlFor="redirectUri">Redirect URI</label>
                    <Input icon={mdiLink} type="url" id="redirectUri"
                           placeholder="https://your-domain.com/api/oidc/callback"
                           value={redirectUri} setValue={setRedirectUri} />
                </div>

                <div className="form-group">
                    <label htmlFor="scope">Scope</label>
                    <Input icon={mdiAccountMultiple} type="text" id="scope"
                           placeholder="openid profile email" value={scope} setValue={setScope} />
                </div>

                <div className="advanced-settings">
                    <Button type="secondary" icon={mdiCog} onClick={() => setShowAdvanced(!showAdvanced)}
                            text={showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"} />

                    {showAdvanced && (
                        <div className="advanced-form">
                            <div className="form-group">
                                <label htmlFor="emailAttr">Email Attribute</label>
                                <Input type="text" id="emailAttr" icon={mdiEmail}
                                       placeholder="email" value={emailAttr} setValue={setEmailAttr} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="usernameAttr">Username Attribute</label>
                                <Input type="text" id="usernameAttr" icon={mdiAccountMultiple}
                                       placeholder="preferred_username" value={usernameAttr}
                                       setValue={setUsernameAttr} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="firstNameAttr">First Name Attribute</label>
                                <Input type="text" id="firstNameAttr" icon={mdiFormTextbox}
                                       placeholder="given_name" value={firstNameAttr} setValue={setFirstNameAttr} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="lastNameAttr">Last Name Attribute</label>
                                <Input type="text" id="lastNameAttr" icon={mdiFormTextbox}
                                       placeholder="family_name" value={lastNameAttr} setValue={setLastNameAttr} />
                            </div>
                        </div>
                    )}
                </div>

                <Button text={provider ? "Save Changes" : "Add Provider"} onClick={handleSubmit} />
            </div>
        </DialogProvider>
    );
};