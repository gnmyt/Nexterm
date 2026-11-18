import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiLockOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const PasswordChange = ({ open, onClose, accountId }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [passwordError, setPasswordError] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const ownAccount = !accountId;

    const showError = (error) => {
        if (error?.message) sendToast(t("common.error"), error.message);
        setPasswordError(true);
        setTimeout(() => setPasswordError(false), 1500);
    };

    const changePassword = () => {
        if (password.length < 3) return;
        if (password !== confirmPassword) return;
        if (ownAccount && !currentPassword) return;

        const request = ownAccount
            ? patchRequest("accounts/password", { currentPassword, password })
            : patchRequest(`users/${accountId}/password`, { password });

        request.then(() => {
            sendToast(t("common.success"), t(ownAccount ? "settings.passwordChange.successOwn" : "settings.passwordChange.successOther"));
            onClose();
        }).catch(showError);
    };

    useEffect(() => {
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="password-change" onKeyDown={e => e.key === "Enter" && changePassword()}>
                <h2>{t("settings.passwordChange.title")}</h2>
                <p>
                    {t(ownAccount ? "settings.passwordChange.descriptionOwn" : "settings.passwordChange.descriptionOther")}
                </p>
                {ownAccount && (
                    <div className="form-group">
                        <IconInput icon={mdiLockOutline} type="password" placeholder={t("settings.passwordChange.currentPassword")}
                                   autoComplete="current-password" customClass={passwordError ? "error" : ""}
                                   value={currentPassword} setValue={setCurrentPassword} />
                    </div>
                )}
                <div className="form-group">
                    <IconInput icon={mdiAccountCircleOutline} type="password" placeholder={t("settings.passwordChange.newPassword")}
                               autoComplete="new-password" customClass={passwordError ? "error" : ""}
                               value={password} setValue={setPassword} />
                </div>
                <div className="form-group">
                    <IconInput icon={mdiAccountCircleOutline} type="password" placeholder={t("settings.passwordChange.confirmPassword")}
                               autoComplete="new-password" customClass={passwordError ? "error" : ""}
                               value={confirmPassword} setValue={setConfirmPassword} />
                </div>
                <Button text={t("settings.passwordChange.changePasswordButton")} onClick={changePassword} />
            </div>
        </DialogProvider>
    );
};
