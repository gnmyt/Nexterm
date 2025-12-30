import { DialogProvider } from "@/common/components/Dialog";
import NextermLogo from "@/common/components/NextermLogo";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { mdiServerNetwork, mdiOpenInNew, mdiContentCopy, mdiMonitor, mdiArrowLeft } from "@mdi/js";
import { useState, useEffect, useContext } from "react";
import { request } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { setActiveServerUrl, getActiveServerUrl, openExternalUrl } from "@/common/utils/TauriUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Icon from "@mdi/react";

const ConnectorIcon = ({ connected }) => (
    <div className={`device-icon-wrapper${connected ? " connected" : ""}`}>
        <Icon path={mdiMonitor} size={1.2} />
    </div>
);

const LinkingHeader = ({ connected = false }) => (
    <div className="linking-header">
        <div className={`linking-logo${connected ? " connected" : ""}`}>
            <NextermLogo size={36} />
        </div>
        <div className={`linking-dots${connected ? " connected" : ""}`}>
            <span className="dot" /><span className="dot" /><span className="dot" />
        </div>
        <ConnectorIcon connected={connected} />
    </div>
);

export const ConnectorSetup = ({ open }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const { updateSessionToken } = useContext(UserContext);
    const [step, setStep] = useState(1);
    const [serverUrl, setServerUrl] = useState(getActiveServerUrl() || "");
    const [connecting, setConnecting] = useState(false);
    const [deviceCode, setDeviceCode] = useState(null);
    const [deviceToken, setDeviceToken] = useState(null);
    const [polling, setPolling] = useState(false);

    useEffect(() => {
        if (!polling || !deviceToken) return;
        const poll = async () => {
            try {
                const result = await request("auth/device/poll", "POST", { token: deviceToken });
                if (result.status === "authorized" && result.token) {
                    setPolling(false);
                    updateSessionToken(result.token);
                    sendToast("Success", t("common.connectorSetup.authSuccess"));
                } else if (result.status === "invalid") await regenerateCode();
            } catch {}
        };
        poll();
        const id = setInterval(poll, 5000);
        return () => clearInterval(id);
    }, [polling, deviceToken]);

    const regenerateCode = async () => {
        try {
            const result = await request("auth/device/create", "POST", { clientType: "connector" });
            if (result.code && typeof result.code === "number") { sendToast("Error", result.message); return; }
            setDeviceCode(result.code);
            setDeviceToken(result.token);
        } catch (e) { sendToast("Error", e.message || t("common.connectorSetup.codeCreationFailed")); }
    };

    const validateServer = async () => {
        if (!serverUrl.trim()) { sendToast("Error", t("common.connectorSetup.enterServerUrl")); return; }
        setConnecting(true);
        const cleanUrl = serverUrl.trim().replace(/\/$/, "");
        try {
            const response = await fetch(`${cleanUrl}/api/service/is-fts`);
            if (!response.ok) throw new Error("Invalid response");
            setActiveServerUrl(cleanUrl);
            const result = await request("auth/device/create", "POST", { clientType: "connector" });
            if (result.code && typeof result.code === "number") { sendToast("Error", result.message); return; }
            setDeviceCode(result.code);
            setDeviceToken(result.token);
            setStep(2);
            setPolling(true);
        } catch { sendToast("Error", t("common.connectorSetup.connectionFailed")); }
        finally { setConnecting(false); }
    };

    const handleOpenBrowser = async () => {
        if (!deviceCode) return;
        const linkUrl = `${getActiveServerUrl()}/link?code=${deviceCode}`;
        await openExternalUrl(linkUrl);
    };

    const copyCode = async () => {
        if (!deviceCode) return;
        try { await navigator.clipboard.writeText(deviceCode); sendToast("Success", t("common.connectorSetup.codeCopied")); }
        catch { sendToast("Error", t("common.connectorSetup.copyFailed")); }
    };

    const handleBack = () => { setPolling(false); setDeviceCode(null); setDeviceToken(null); setStep(1); setActiveServerUrl(null); };

    return (
        <DialogProvider disableClosing open={open}>
            <div className="connector-setup">
                <LinkingHeader connected={step === 2 && polling} />
                
                <h2 className="linking-title">{t("common.connectorSetup.title")}</h2>

                {step === 1 && (
                    <form className="connector-form" onSubmit={(e) => { e.preventDefault(); validateServer(); }}>
                        <p className="linking-description">{t("common.connectorSetup.serverUrlDescription")}</p>
                        <div className="form-group">
                            <label htmlFor="serverUrl">{t("common.connectorSetup.serverUrl")}</label>
                            <Input type="text" id="serverUrl" icon={mdiServerNetwork} placeholder="https://nexterm.example.com" value={serverUrl} setValue={setServerUrl} />
                        </div>
                        <Button text={connecting ? t("common.connectorSetup.connecting") : t("common.connectorSetup.connect")} disabled={connecting} />
                    </form>
                )}

                {step === 2 && (
                    <div className="connector-code-step">
                        <p className="linking-description">{t("common.connectorSetup.enterCodeDescription")}</p>
                        <div className="code-display" onClick={copyCode}>
                            <span className="code-value">{deviceCode || "----"}</span>
                            <button className="code-copy" type="button" title={t("common.connectorSetup.copyCode")}>
                                <Icon path={mdiContentCopy} size={0.8} />
                            </button>
                        </div>
                        <div className="linking-actions">
                            <Button text={t("common.connectorSetup.openBrowser")} icon={mdiOpenInNew} onClick={handleOpenBrowser} />
                            <Button type="secondary" text={t("common.actions.back")} icon={mdiArrowLeft} onClick={handleBack} />
                        </div>
                    </div>
                )}
            </div>
        </DialogProvider>
    );
};
