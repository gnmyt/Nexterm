import { DialogProvider } from "@/common/components/Dialog";
import NextermLogo from "@/common/components/NextermLogo";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiKeyOutline, mdiFingerprint, mdiServerNetwork } from "@mdi/js";
import { useContext, useEffect, useState } from "react";
import { getRequest, request } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { startAuthentication } from "@simplewebauthn/browser";
import { isTauri, getActiveServerUrl, setActiveServerUrl as saveServerUrl } from "@/common/utils/TauriUtil.js";

export const LoginDialog = ({ open }) => {
    const { t } = useTranslation();
    const isConnectorMode = isTauri();
    const [serverUrl, setServerUrl] = useState(getActiveServerUrl() || "");
    const [serverConnected, setServerConnected] = useState(!!getActiveServerUrl());

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [code, setCode] = useState("");
    const [providers, setProviders] = useState([]);
    const [internalAuthEnabled, setInternalAuthEnabled] = useState(true);
    const [passkeyLoading, setPasskeyLoading] = useState(false);

    const { sendToast } = useToast();

    const [totpRequired, setTotpRequired] = useState(false);

    const { updateSessionToken, firstTimeSetup } = useContext(UserContext);

    const isInternalAuthEnabled = () => {
        if (firstTimeSetup) return true;
        return internalAuthEnabled;
    };

    const loadProviders = async () => {
        if (isConnectorMode && !serverConnected) return;
        
        try {
            const providers = await getRequest("auth/providers");

            const internalProvider = providers.find(p => p.isInternal);
            const externalProviders = providers.filter(p => !p.isInternal && p.enabled);
            
            const internalAuthEnabled = internalProvider ? Boolean(internalProvider.enabled) : false;
            setInternalAuthEnabled(internalAuthEnabled);
            setProviders(externalProviders);

            if (!firstTimeSetup && externalProviders.length === 1 && !internalAuthEnabled) {
                setTimeout(() => {
                    handleOIDCLogin(null, externalProviders[0].id);
                }, 300);
            }
        } catch (error) {
            if (isConnectorMode) {
                sendToast("Error", "Failed to connect to server. Please check the URL.");
            } else {
                sendToast("Error", t('common.errors.loadingAuthProviders', { error: error }));
            }
        }
    };

    useEffect(() => {
        if (open && (!isConnectorMode || serverConnected)) {
            loadProviders();
        }
    }, [open, serverConnected]);

    const createAccountFirst = async () => {
        try {
            await request("accounts/register", "POST", { username, password, firstName, lastName });
            return true;
        } catch (error) {
            sendToast("Error", error.message || t('common.errors.generalError'));
            return false;
        }
    };

    const submit = async (event) => {
        event.preventDefault();

        if (isConnectorMode && serverUrl && serverUrl.trim()) {
            const cleanUrl = serverUrl.trim().replace(/\/$/, "");
            saveServerUrl(cleanUrl);

            if (!serverConnected) {
                setServerConnected(true);
                return;
            }
        }

        if (isConnectorMode && !serverUrl) {
            sendToast("Error", "Please enter a server URL first");
            return;
        }

        if (!isInternalAuthEnabled()) {
            sendToast("Error", t('common.errors.internalAuthDisabled'));
            return;
        }

        if (firstTimeSetup && !await createAccountFirst()) return;

        let resultObj;
        try {
            resultObj = await request("auth/login", "POST", {
                username,
                password,
                code: totpRequired ? code : undefined,
            });
        } catch (error) {
            sendToast("Error", error.message || t('common.errors.generalError'));
            return;
        }

        if (resultObj.code === 201) sendToast("Error", t('common.errors.invalidCredentials'));
        if (resultObj.code === 202) setTotpRequired(true);
        if (resultObj.code === 203) sendToast("Error", t('common.errors.invalidTwoFactor'));
        if (resultObj.code === 403) sendToast("Error", t('common.errors.internalAuthDisabled'));
        if (resultObj.token) {
            updateSessionToken(resultObj.token);
        }
    };

    const handleOIDCLogin = async (event, providerId) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            const response = await request("auth/oidc/login/" + providerId, "POST");
            if (response.url) {
                window.location.href = response.url;
            }
        } catch (error) {
            sendToast("Error", error.message || t('common.errors.ssoLoginFailed'));
        }
    };

    const handlePasskeyLogin = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        setPasskeyLoading(true);

        const origin = window.location.origin;

        try {
            const options = await request("auth/passkey/options", "POST", { origin });
            
            if (options.code) {
                sendToast("Error", options.message || t('common.errors.passkeyLoginFailed'));
                setPasskeyLoading(false);
                return;
            }

            const credential = await startAuthentication({ optionsJSON: options });

            const result = await request("auth/passkey/verify", "POST", { response: credential, origin });

            if (result.code) {
                sendToast("Error", result.message || t('common.errors.passkeyLoginFailed'));
            } else if (result.token) {
                updateSessionToken(result.token);
            }
        } catch (error) {
            console.error("Passkey login failed:", error);
            if (error.name === "NotAllowedError") {
                sendToast("Error", t('common.errors.passkeyCancelled'));
            } else {
                sendToast("Error", error.message || t('common.errors.passkeyLoginFailed'));
            }
        } finally {
            setPasskeyLoading(false);
        }
    };

    return (
        <DialogProvider disableClosing open={open}>
            <div className="login-dialog">
                <div className="login-logo">
                    <NextermLogo size={48} />
                    <h1>{firstTimeSetup ? t('common.loginDialog.registrationTitle') : t('common.loginDialog.title')}</h1>
                </div>
                <form className="login-form" onSubmit={submit}>
                    {isConnectorMode && (
                        <div className="form-group server-url-group">
                            <label htmlFor="serverUrl">Server URL</label>
                            <Input 
                                type="text" 
                                id="serverUrl" 
                                icon={mdiServerNetwork}
                                placeholder="https://nexterm.example.com" 
                                value={serverUrl} 
                                setValue={setServerUrl}
                            />
                        </div>
                    )}

                    {firstTimeSetup ? (
                        <div className="register-name-row">
                            <div className="form-group">
                                <label htmlFor="firstName">{t('common.labels.firstName')}</label>
                                <Input type="text" id="firstName" required icon={mdiAccountCircleOutline}
                                       placeholder={t('common.placeholders.firstName')} autoComplete="given-name"
                                       value={firstName} setValue={setFirstName} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="lastName">{t('common.labels.lastName')}</label>
                                <Input type="text" id="lastName" required icon={mdiAccountCircleOutline}
                                       placeholder={t('common.placeholders.lastName')} autoComplete="family-name"
                                       value={lastName} setValue={setLastName} />
                            </div>
                        </div>
                    ) : null}

                    {(!totpRequired && isInternalAuthEnabled()) ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="username">{t('common.labels.username')}</label>
                                <Input type="text" id="username" required icon={mdiAccountCircleOutline}
                                       placeholder={t('common.placeholders.username')} autoComplete="username"
                                       value={username} setValue={setUsername} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">{t('common.labels.password')}</label>
                                <Input type="password" id="password" required icon={mdiKeyOutline}
                                       placeholder={t('common.placeholders.password')} autoComplete="current-password"
                                       value={password} setValue={setPassword} />
                            </div>
                        </>
                    ) : null}

                    {totpRequired ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="code">{t('common.labels.twoFACode')}</label>
                                <Input type="number" id="code" required icon={mdiKeyOutline}
                                       placeholder={t('common.placeholders.code')} autoComplete="one-time-code"
                                       value={code} setValue={setCode} />
                            </div>
                        </>
                    ) : null}

                    {isInternalAuthEnabled() ? <Button text={firstTimeSetup ? t('common.actions.register') : t('common.actions.login')} /> : null}

                    {(!firstTimeSetup && !totpRequired) ? (
                        <div className="sso-options">
                            {isInternalAuthEnabled() && (
                                <div className="divider">
                                    <span>{t('common.loginDialog.ssoOrContinueWith')}</span>
                                </div>
                            )}
                            <div className="sso-buttons">
                                <Button
                                    type="secondary"
                                    icon={mdiFingerprint}
                                    text={passkeyLoading ? t('common.loginDialog.authenticating') : t('common.loginDialog.signInWithPasskey')}
                                    onClick={handlePasskeyLogin}
                                    disabled={passkeyLoading}
                                    buttonType="button"
                                />
                                {providers.map(provider => (
                                    <Button
                                        key={provider.id}
                                        type="secondary"
                                        text={provider.name}
                                        onClick={(e) => handleOIDCLogin(e, provider.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {(!firstTimeSetup && !isInternalAuthEnabled() && providers.length === 0) ? (
                        <p>{t('common.loginDialog.noAuthMethodsAvailable')}</p>
                    ) : null}
                </form>
            </div>
        </DialogProvider>
    );
};