import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiAccountCircleOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const PasswordChange = ({ open, onClose, accountId }) => {
    const { t } = useTranslation();
    const [passwordError, setPasswordError] = useState(false);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const patchCurrent = () => {
        patchRequest("accounts/password", { password }).then(() => onClose()).catch(() => {
            setPasswordError(true);

            setTimeout(() => {
                setPasswordError(false);
            }, 1500);
        });
    }

    const patchOther = () => {
        patchRequest(`users/${accountId}/password`, { password }).then(() => onClose()).catch(() => {
            setPasswordError(true);

            setTimeout(() => {
                setPasswordError(false);
            }, 1500);
        });
    }

    const changePassword = () => {
        if (password.length < 3) return;
        if (password !== confirmPassword) return;

        if (!accountId) {
            patchCurrent();
            return;
        }

        patchOther();
    };

    useEffect(() => {
        setPassword("");
        setConfirmPassword("");
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="password-change" onKeyDown={e => e.key === "Enter" && changePassword()}>
                <h2>{t("settings.passwordChange.title")}</h2>
                <p>
                    {t("settings.passwordChange.description")}
                </p>
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