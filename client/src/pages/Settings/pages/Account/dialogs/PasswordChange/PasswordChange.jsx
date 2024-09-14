import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiAccountCircleOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { useEffect, useState } from "react";

export const PasswordChange = ({ open, onClose, accountId }) => {
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
                <h2>Change password</h2>
                <p>
                    A strong password contains special characters, numbers, and
                    letters in both uppercase and lowercase.
                </p>
                <div className="form-group">
                    <IconInput icon={mdiAccountCircleOutline} type="password" placeholder="New password"
                               autoComplete="new-password" customClass={passwordError ? "error" : ""}
                               value={password} setValue={setPassword} />
                </div>
                <div className="form-group">
                    <IconInput icon={mdiAccountCircleOutline} type="password" placeholder="Confirm new password"
                               autoComplete="new-password" customClass={passwordError ? "error" : ""}
                               value={confirmPassword} setValue={setConfirmPassword} />
                </div>
                <Button text="Change password" onClick={changePassword} />
            </div>
        </DialogProvider>
    );
};