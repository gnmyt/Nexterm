import { DialogProvider } from "@/common/components/Dialog";
import NextermLogo from "@/common/components/NextermLogo";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiKeyOutline, mdiFingerprint, mdiQrcode, mdiArrowLeft } from "@mdi/js";
import { useContext, useEffect, useRef, useState } from "react";
import { getRequest, request } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { startAuthentication } from "@simplewebauthn/browser";
import { getProviderIcon } from "@/common/utils/iconUtils";
import { QRCodeCanvas } from "qrcode.react";

export const LoginDialog = ({ open }) => {
    const { t } = useTranslation();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [code, setCode] = useState("");
    const [providers, setProviders] = useState([]);
    const [internalAuthEnabled, setInternalAuthEnabled] = useState(true);
    const [passkeyLoading, setPasskeyLoading] = useState(false);

    const [qrMode, setQrMode] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const pollTimerRef = useRef(null);

    const { sendToast } = useToast();

    const [totpRequired, setTotpRequired] = useState(false);

    const { updateSessionToken, firstTimeSetup } = useContext(UserContext);

    const isInternalAuthEnabled = () => {
        if (firstTimeSetup) return true;
        return internalAuthEnabled;
    };

    const loadProviders = async () => {
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
            sendToast("Error", t('common.errors.loadingAuthProviders', { error: error }));
        }
    };

    useEffect(() => {
        if (open) {
            loadProviders();
        }
    }, [open]);

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

    const stopPolling = () => {
        if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };

    const startQrLogin = async () => {
        setQrLoading(true);
        try {
            const result = await request("auth/device/create", "POST", { clientType: "web" });
            if (result?.code && typeof result.code === "number") {
                sendToast("Error", result.message || t('common.errors.generalError'));
                return;
            }
            setQrCode(result.code);
            setQrMode(true);
            stopPolling();
            pollTimerRef.current = setInterval(async () => {
                try {
                    const poll = await request("auth/device/poll", "POST", { token: result.token });
                    if (poll.status === "authorized" && poll.token) { stopPolling(); updateSessionToken(poll.token); }
                    else if (poll.status === "invalid") { stopPolling(); setQrCode(null); setQrMode(false); sendToast("Error", t('common.errors.qrCodeExpired')); }
                } catch (_) {}
            }, 3000);
        } catch (error) {
            sendToast("Error", error.message || t('common.errors.generalError'));
        } finally { setQrLoading(false); }
    };

    const exitQrMode = () => { stopPolling(); setQrMode(false); setQrCode(null); };

    useEffect(() => () => stopPolling(), []);

    const getQrValue = () => `nexterm://authorize?code=${qrCode}&server=${encodeURIComponent(window.location.origin)}`;

    return (
        <DialogProvider disableClosing open={open}>
            <div className={"login-dialog" + (qrMode ? " qr-mode" : "")}>
                <div className="login-logo">
                    <NextermLogo size={48} />
                    <h1>{firstTimeSetup ? t('common.loginDialog.registrationTitle') : t('common.loginDialog.title')}</h1>
                </div>

                {qrMode ? (
                    <div className="qr-login-container">
                        <p className="qr-login-description">{t('common.loginDialog.qrScanDescription')}</p>
                        <div className="qr-code-wrapper">
                            {qrCode ? (
                                <QRCodeCanvas
                                    value={getQrValue()}
                                    size={200}
                                    bgColor="transparent"
                                    fgColor="#ffffff"
                                    level="M"
                                />
                            ) : null}
                        </div>
                        <div className="qr-device-code">{qrCode}</div>
                        <Button
                            type="secondary"
                            icon={mdiArrowLeft}
                            text={t('common.loginDialog.backToLogin')}
                            onClick={exitQrMode}
                            buttonType="button"
                        />
                    </div>
                ) : (
                <form className="login-form" onSubmit={submit}>
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
                                    icon={mdiQrcode}
                                    text={qrLoading ? t('common.loginDialog.authenticating') : t('common.loginDialog.signInWithQrCode')}
                                    onClick={startQrLogin}
                                    disabled={qrLoading}
                                    buttonType="button"
                                />
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
                                    icon={getProviderIcon(provider)}
                                    text={provider.name}
                                    onClick={(e) => handleOIDCLogin(e, provider.id)}
                                    buttonType="button"
                                />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {(!firstTimeSetup && !isInternalAuthEnabled() && providers.length === 0) ? (
                        <p>{t('common.loginDialog.noAuthMethodsAvailable')}</p>
                    ) : null}
                </form>
                )}
            </div>
        </DialogProvider>
    );
};