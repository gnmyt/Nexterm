import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiAccountCircleOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { useState } from "react";

export const PasswordChange = ({ open, onClose }) => {

    const [passwordError, setPasswordError] = useState(false);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const changePassword = () => {
        if (password.length < 5) return;
        if (password !== confirmPassword) return;

        patchRequest("accounts/password", { password }).then(() => onClose()).catch(err => {
            setPasswordError(true);

            setTimeout(() => {
                setPasswordError(false);
            }, 1500);
        });
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="password-change">
                <h2>Change password</h2>
                <p>
                    Enter your new password below. Make sure it is at least 5 characters long and
                    contains at least one number and one special character.
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