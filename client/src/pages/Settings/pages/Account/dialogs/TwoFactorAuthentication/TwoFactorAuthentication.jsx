import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiKey } from "@mdi/js";
import Button from "@/common/components/Button";
import { useContext, useEffect, useState } from "react";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { QRCodeCanvas } from "qrcode.react";
import "./styles.sass";
import { UserContext } from "@/common/contexts/UserContext.jsx";

export const TwoFactorAuthentication = ({open, onClose}) => {

    const { login } = useContext(UserContext);

    const [code, setCode] = useState("");
    const [setupFailed, setSetupFailed] = useState(false);
    const [totpObj, setTotpObj] = useState(null);

    const enableTotp = async () => {
        try {
            await postRequest("accounts/totp/enable", { code });
            login();
            onClose();
        } catch (error) {
            setSetupFailed(true);

            setTimeout(() => {
                setSetupFailed(false);
            }, 2000);
        }
    }

    useEffect(() => {
        getRequest("accounts/totp/secret").then((response) => {
            if (response.secret)  setTotpObj(response);
        });
    }, []);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="two-factor-dialog" onKeyDown={(event) => event.key === "Enter" && enableTotp()}>
                <div className="info-area">
                    <h1>Enable 2FA</h1>
                    <p>Scan the code with your authenticator app
                        or enter <span className="totp-code">{totpObj?.secret}</span> manually.</p>

                    <div className="action-row">
                        <IconInput icon={mdiKey} placeholder="Enter 2FA code" value={code} setValue={setCode}
                                      customClass={setupFailed ? "setup-error" : ""} />

                        <Button text="Enable" onClick={() => enableTotp()} />
                    </div>
                </div>

                <div className="qr-code">
                    <QRCodeCanvas value={totpObj ? totpObj?.url : ""} size={150} />
                </div>
            </div>
        </DialogProvider>
    )
}