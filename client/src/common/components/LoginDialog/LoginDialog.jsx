import { DialogProvider } from "@/common/components/Dialog";
import NextermLogo from "@/common/components/NextermLogo";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import {
    mdiAccountCircleOutline, mdiKeyOutline, mdiFingerprint, mdiQrcode, mdiArrowLeft, mdiShieldKeyOutline,
    mdiLoading, mdiInformationOutline,
} from "@mdi/js";
import Icon from "@mdi/react";
import { useContext, useEffect, useRef, useState } from "react";
import { getRequest, request } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { startAuthentication } from "@simplewebauthn/browser";
import { getProviderIcon } from "@/common/utils/iconUtils";
import { QRCodeCanvas } from "qrcode.react";
import { createAutoLoginSuppressionGuard } from "@/common/utils/OIDCLogoutUtil.js";
import Field from "@/common/components/Field";

export const LoginDialog = ({ open }) => {
    const { t } = useTranslation();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [code, setCode] = useState("");
    const [providers, setProviders] = useState([]);
    const [internalAuthEnabled, setInternalAuthEnabled] = useState(true);
    const [registrationEnabled, setRegistrationEnabled] = useState(false);
    const [registerMode, setRegisterMode] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [qrMode, setQrMode] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const pollTimerRef = useRef(null);
    const autoLoginSuppressionGuardRef = useRef(null);

    if (!autoLoginSuppressionGuardRef.current) {
        autoLoginSuppressionGuardRef.current = createAutoLoginSuppressionGuard();
    }

    const { sendToast } = useToast();

    const [totpRequired, setTotpRequired] = useState(false);

    const { updateSessionToken, firstTimeSetup } = useContext(UserContext);

    const registrationView = firstTimeSetup || registerMode;

    const isInternalAuthEnabled = () => {
        if (registrationView) return true;
        return internalAuthEnabled;
    };

    const loadProviders = async (skipAutoLogin = false) => {
        try {
            const providers = await getRequest("auth/providers");

            const internalProvider = providers.find(p => p.isInternal);
            const externalProviders = providers.filter(p => !p.isInternal && p.enabled);

            const internalAuthEnabled = internalProvider ? Boolean(internalProvider.enabled) : false;
            setInternalAuthEnabled(internalAuthEnabled);
            setRegistrationEnabled(internalProvider ? Boolean(internalProvider.allowRegistration) : false);
            setProviders(externalProviders);

            if (!skipAutoLogin && !firstTimeSetup && externalProviders.length === 1 && !internalAuthEnabled) {
                setTimeout(() => {
                    handleOIDCLogin(null, externalProviders[0].id);
                }, 300);
            }
        } catch (error) {
            sendToast("Error", t("common.errors.loadingAuthProviders", { error: error }));
        }
    };

    useEffect(() => {
        if (open) {
            void loadProviders(autoLoginSuppressionGuardRef.current(true));
        } else {
            autoLoginSuppressionGuardRef.current(false);
        }
    }, [open]);

    const createAccountFirst = async () => {
        try {
            const result = await request("accounts/register", "POST", { username, password, firstName, lastName });
            if (result?.code) {
                sendToast("Error", result.message || t("common.errors.generalError"));
                return false;
            }
            return true;
        } catch (error) {
            sendToast("Error", error.message || t("common.errors.generalError"));
            return false;
        }
    };

    const submit = async (event) => {
        event.preventDefault();

        if (!isInternalAuthEnabled()) {
            sendToast("Error", t("common.errors.internalAuthDisabled"));
            return;
        }

        setSubmitting(true);
        try {
            if (registrationView && !await createAccountFirst()) return;

            let resultObj;
            try {
                resultObj = await request("auth/login", "POST", {
                    username,
                    password,
                    code: totpRequired ? code : undefined,
                });
            } catch (error) {
                sendToast("Error", error.message || t("common.errors.generalError"));
                return;
            }

            if (resultObj.code === 201) sendToast("Error", t("common.errors.invalidCredentials"));
            if (resultObj.code === 202) setTotpRequired(true);
            if (resultObj.code === 203) sendToast("Error", t("common.errors.invalidTwoFactor"));
            if (resultObj.code === 403) sendToast("Error", t("common.errors.internalAuthDisabled"));
            if (resultObj.token) {
                updateSessionToken(resultObj.token);
            }
        } finally {
            setSubmitting(false);
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
            sendToast("Error", error.message || t("common.errors.ssoLoginFailed"));
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
                sendToast("Error", options.message || t("common.errors.passkeyLoginFailed"));
                setPasskeyLoading(false);
                return;
            }

            const credential = await startAuthentication({ optionsJSON: options });

            const result = await request("auth/passkey/verify", "POST", { response: credential, origin });

            if (result.code) {
                sendToast("Error", result.message || t("common.errors.passkeyLoginFailed"));
            } else if (result.token) {
                updateSessionToken(result.token);
            }
        } catch (error) {
            console.error("Passkey login failed:", error);
            if (error.name === "NotAllowedError") {
                sendToast("Error", t("common.errors.passkeyCancelled"));
            } else {
                sendToast("Error", error.message || t("common.errors.passkeyLoginFailed"));
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
                sendToast("Error", result.message || t("common.errors.generalError"));
                return;
            }
            setQrCode(result.code);
            setQrMode(true);
            stopPolling();
            pollTimerRef.current = setInterval(async () => {
                try {
                    const poll = await request("auth/device/poll", "POST", { token: result.token });
                    if (poll.status === "authorized" && poll.token) { stopPolling(); updateSessionToken(poll.token); }
                    else if (poll.status === "invalid") { stopPolling(); setQrCode(null); setQrMode(false); sendToast("Error", t("common.errors.qrCodeExpired")); }
                } catch (_) {}
            }, 3000);
        } catch (error) {
            sendToast("Error", error.message || t("common.errors.generalError"));
        } finally { setQrLoading(false); }
    };

    const exitQrMode = () => { stopPolling(); setQrMode(false); setQrCode(null); };
    const exitTotp = () => { setTotpRequired(false); setCode(""); };

    useEffect(() => () => stopPolling(), []);

    const getQrValue = () => `nexterm://authorize?code=${qrCode}&server=${encodeURIComponent(window.location.origin)}`;
    const qrColor = () => getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#ffffff";

    const showSso = !registrationView && !totpRequired;
    const hasAnyMethod = isInternalAuthEnabled() || providers.length > 0;

    const headerTitle = qrMode ? t("common.loginDialog.qrTitle")
        : totpRequired ? t("common.loginDialog.twoFactorTitle")
        : registrationView ? t("common.loginDialog.registrationTitle")
        : t("common.loginDialog.welcome");
    const headerSubtitle = qrMode ? t("common.loginDialog.qrScanDescription")
        : totpRequired ? t("common.loginDialog.twoFactorDescription")
        : firstTimeSetup ? t("common.loginDialog.firstTimeSubtitle")
        : registrationView ? t("common.loginDialog.registrationSubtitle")
        : t("common.loginDialog.subtitle");

    return (
        <DialogProvider disableClosing open={open} className="login-card">
            <div className="login">
                <header className="login__header dialog-heading">
                    <div className="login__brand">
                        <NextermLogo size={40} />
                        <span>{t("common.loginDialog.title")}</span>
                    </div>
                    <h1>{headerTitle}</h1>
                    <p>{headerSubtitle}</p>
                </header>

                {qrMode ? (
                    <div className="login__qr">
                        <div className="login__qr-tile">
                            {qrCode ? (
                                <QRCodeCanvas value={getQrValue()} size={192} bgColor="transparent" fgColor={qrColor()} level="M" />
                            ) : (
                                <Icon path={mdiLoading} spin={1} className="login__qr-spinner" />
                            )}
                        </div>
                        {qrCode && <div className="login__qr-code" aria-label={t("common.loginDialog.qrTitle")}>{qrCode}</div>}
                        <Button type="secondary" icon={mdiArrowLeft} text={t("common.loginDialog.backToLogin")}
                                onClick={exitQrMode} buttonType="button" className="login__wide" />
                    </div>
                ) : (
                    <form className="login__form" onSubmit={submit}>
                        {registrationView && (
                            <div className="login__row">
                                <Field className="login__field" label={t("common.labels.firstName")} htmlFor="firstName">
                                    <Input type="text" id="firstName" required icon={mdiAccountCircleOutline}
                                           placeholder={t("common.placeholders.firstName")} autoComplete="given-name"
                                           value={firstName} setValue={setFirstName} />
                                </Field>
                                <Field className="login__field" label={t("common.labels.lastName")} htmlFor="lastName">
                                    <Input type="text" id="lastName" required icon={mdiAccountCircleOutline}
                                           placeholder={t("common.placeholders.lastName")} autoComplete="family-name"
                                           value={lastName} setValue={setLastName} />
                                </Field>
                            </div>
                        )}

                        {!totpRequired && isInternalAuthEnabled() && (
                            <>
                                <Field className="login__field" label={t("common.labels.username")} htmlFor="username">
                                    <Input type="text" id="username" required icon={mdiAccountCircleOutline}
                                           placeholder={t("common.placeholders.username")} autoComplete="username"
                                           value={username} setValue={setUsername} autoFocus />
                                </Field>
                                <Field className="login__field" label={t("common.labels.password")} htmlFor="password">
                                    <Input type="password" id="password" required icon={mdiKeyOutline}
                                           placeholder={t("common.placeholders.password")}
                                           autoComplete={registrationView ? "new-password" : "current-password"}
                                           value={password} setValue={setPassword} />
                                </Field>
                            </>
                        )}

                        {totpRequired && (
                            <Field className="login__field" label={t("common.labels.twoFACode")} htmlFor="code">
                                <Input type="number" id="code" required icon={mdiShieldKeyOutline}
                                       placeholder={t("common.placeholders.code")} autoComplete="one-time-code"
                                       value={code} setValue={setCode} autoFocus />
                            </Field>
                        )}

                        {isInternalAuthEnabled() && (
                            <Button className="login__wide login__submit" buttonType="submit" disabled={submitting}
                                    icon={submitting ? mdiLoading : undefined} spin={submitting}
                                    text={registrationView ? t("common.actions.register") : t("common.actions.login")} />
                        )}

                        {totpRequired && (
                            <button type="button" className="login__link" onClick={exitTotp}>
                                <Icon path={mdiArrowLeft} />
                                {t("common.loginDialog.backToLogin")}
                            </button>
                        )}

                        {registrationEnabled && !firstTimeSetup && !totpRequired && (
                            <p className="login__switch">
                                <span>{registerMode ? t("common.loginDialog.haveAccount") : t("common.loginDialog.noAccount")}</span>
                                <button type="button" onClick={() => setRegisterMode(!registerMode)}>
                                    {registerMode ? t("common.actions.login") : t("common.actions.register")}
                                </button>
                            </p>
                        )}

                        {showSso && (
                            <div className="login__methods">
                                {isInternalAuthEnabled() && (
                                    <div className="login__divider"><span>{t("common.loginDialog.ssoOrContinueWith")}</span></div>
                                )}
                                <Button type="secondary" className="login__wide" buttonType="button"
                                        icon={qrLoading ? mdiLoading : mdiQrcode} spin={qrLoading}
                                        text={qrLoading ? t("common.loginDialog.authenticating") : t("common.loginDialog.signInWithQrCode")}
                                        onClick={startQrLogin} disabled={qrLoading} />
                                <Button type="secondary" className="login__wide" buttonType="button"
                                        icon={passkeyLoading ? mdiLoading : mdiFingerprint} spin={passkeyLoading}
                                        text={passkeyLoading ? t("common.loginDialog.authenticating") : t("common.loginDialog.signInWithPasskey")}
                                        onClick={handlePasskeyLogin} disabled={passkeyLoading} />
                                {providers.map(provider => (
                                    <Button key={provider.id} type="secondary" className="login__wide" buttonType="button"
                                            icon={getProviderIcon(provider)} text={provider.name}
                                            onClick={(e) => handleOIDCLogin(e, provider.id)} />
                                ))}
                            </div>
                        )}

                        {!registrationView && !hasAnyMethod && (
                            <p className="login__note">
                                <Icon path={mdiInformationOutline} />
                                <span>{t("common.loginDialog.noAuthMethodsAvailable")}</span>
                            </p>
                        )}
                    </form>
                )}
            </div>
        </DialogProvider>
    );
};
