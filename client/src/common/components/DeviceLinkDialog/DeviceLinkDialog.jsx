import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { mdiLinkVariant, mdiCheck, mdiCellphone, mdiMonitor } from "@mdi/js";
import { useState, useEffect } from "react";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import NextermLogo from "@/common/components/NextermLogo";

const DeviceIcon = ({ type, connected }) => (
    <div className={`device-icon-wrapper${connected ? " connected" : ""}`}>
        <Icon path={type === "mobile" ? mdiCellphone : mdiMonitor} size={1.2} />
    </div>
);

const LinkingHeader = ({ clientType, connected = false }) => (
    <div className="linking-header">
        <div className={`linking-logo${connected ? " connected" : ""}`}><NextermLogo size={36} /></div>
        <div className={`linking-dots${connected ? " connected" : ""}`}>
            <span className="dot" /><span className="dot" /><span className="dot" />
        </div>
        <DeviceIcon type={clientType} connected={connected} />
    </div>
);

export const DeviceLinkContent = ({ prefillCode = "", onClose, isPage = false }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [code, setCode] = useState(prefillCode);
    const [loading, setLoading] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [step, setStep] = useState("code");

    useEffect(() => { if (prefillCode) { setCode(prefillCode); handleContinue(prefillCode); } }, [prefillCode]);

    const formatCode = (v) => { const c = v.toUpperCase().replace(/[^A-Z0-9]/g, ""); return c.length <= 4 ? c : `${c.slice(0, 4)}-${c.slice(4, 8)}`; };

    const handleCodeChange = (value) => { setCode(formatCode(value)); };

    const handleContinue = async (deviceCode = code) => {
        if (deviceCode.length !== 9) return;
        setLoading(true);
        try {
            const result = await postRequest("auth/device/info", { code: deviceCode });
            if (result.code) sendToast("Error", result.message || t("common.deviceLink.invalidCode"));
            else { setDeviceInfo(result); setStep("confirm"); }
        } catch (err) { sendToast("Error", err.message || t("common.deviceLink.invalidCode")); }
        finally { setLoading(false); }
    };

    const handleAuthorize = async () => {
        setLoading(true);
        try {
            const result = await postRequest("auth/device/authorize", { code });
            if (result.code) sendToast("Error", result.message);
            else { setStep("success"); sendToast("Success", t("common.deviceLink.deviceAuthorized")); }
        } catch (err) { sendToast("Error", err.message || t("common.deviceLink.authorizationFailed")); }
        finally { setLoading(false); }
    };

    const handleKeyDown = (e) => { if (e.key === "Enter" && code.length === 9) handleContinue(); };

    const getTypeName = (type) => t(`common.deviceLink.clientTypes.${type === "mobile" ? "mobile" : "connector"}`);

    if (step === "success") {
        return (
            <div className="device-link-content">
                <LinkingHeader clientType={deviceInfo?.clientType || "connector"} connected />
                <div className="device-link-success">
                    <h3>{t("common.deviceLink.successTitle")}</h3>
                    <p>{t("common.deviceLink.successMessage")}</p>
                    {!isPage && <Button text={t("common.actions.close")} onClick={onClose} />}
                </div>
            </div>
        );
    }

    if (step === "confirm" && deviceInfo) {
        return (
            <div className="device-link-content">
                <LinkingHeader clientType={deviceInfo.clientType} />
                <div className="confirm-step">
                    <h2>{t("common.deviceLink.confirmTitle")}</h2>
                    <p className="linking-description">{t("common.deviceLink.confirmDescription")}</p>
                    <div className="device-info">
                        <div className="device-info-row">
                            <Icon path={deviceInfo.clientType === "mobile" ? mdiCellphone : mdiMonitor} size={0.9} />
                            <span className="device-info-label">{t("common.deviceLink.type")}:</span>
                            <span className="device-info-value">{getTypeName(deviceInfo.clientType)}</span>
                        </div>
                        <div className="device-info-row">
                            <span className="device-info-label">{t("common.deviceLink.ipAddress")}:</span>
                            <span className="device-info-value">{deviceInfo.ipAddress}</span>
                        </div>
                        <div className="device-info-row">
                            <span className="device-info-label">{t("common.deviceLink.userAgent")}:</span>
                            <span className="device-info-value device-info-useragent">{deviceInfo.userAgent}</span>
                        </div>
                    </div>
                    <Button text={loading ? t("common.deviceLink.authorizing") : t("common.deviceLink.authorize")} 
                            icon={mdiCheck} onClick={handleAuthorize} disabled={loading} />
                </div>
            </div>
        );
    }

    return (
        <div className="device-link-content">
            <LinkingHeader clientType="connector" />
            <div className="code-step">
                <h2>{t("common.deviceLink.title")}</h2>
                <p className="linking-description">{t("common.deviceLink.description")}</p>
                <div className="form-group">
                    <label htmlFor="deviceCode">{t("common.deviceLink.codeLabel")}</label>
                    <Input type="text" id="deviceCode" icon={mdiLinkVariant} placeholder="XXXX-XXXX" 
                           value={code} setValue={handleCodeChange} maxLength={9} autoComplete="off" onKeyDown={handleKeyDown} />
                </div>
                <Button text={loading ? t("common.deviceLink.verifying") : t("common.deviceLink.continue")} 
                        onClick={() => handleContinue()} disabled={code.length !== 9 || loading} />
            </div>
        </div>
    );
};

export const DeviceLinkDialog = ({ open, onClose, prefillCode = "" }) => {
    const [localCode, setLocalCode] = useState(prefillCode);

    useEffect(() => { if (prefillCode) setLocalCode(prefillCode); }, [prefillCode]);
    useEffect(() => { if (!open) setLocalCode(prefillCode || ""); }, [open, prefillCode]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="device-link-dialog">
                <DeviceLinkContent prefillCode={localCode} onClose={onClose} />
            </div>
        </DialogProvider>
    );
};
