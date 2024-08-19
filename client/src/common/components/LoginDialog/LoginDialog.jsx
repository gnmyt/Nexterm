import { DialogProvider } from "@/common/components/Dialog";
import NextermLogo from "@/common/img/logo.png";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiKeyOutline } from "@mdi/js";
import { useContext, useEffect, useState } from "react";
import { request } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";

export const LoginDialog = ({ open }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");

    const [totpRequired, setTotpRequired] = useState(false);

    const [error, setError] = useState("");

    const { updateSessionToken } = useContext(UserContext);

    const submit = async (event) => {
        event.preventDefault();

        let resultObj;
        try {
            resultObj = await request("auth/login", "POST", { username, password,
                code: totpRequired ? code : undefined });
        } catch (error) {
            setError(error.message || "An error occurred");
            return;
        }

        if (resultObj.code === 201) setError("Invalid username or password");

        if (resultObj.code === 202) setTotpRequired(true);

        if (resultObj.code === 203) setError("Invalid two-factor code");


        if (resultObj.token) {
            updateSessionToken(resultObj.token);
        }
    };

    useEffect(() => {
        setError("");
    }, [username, password, code]);

    return (
        <DialogProvider disableClosing open={open}>
            <div className="login-dialog">
                <div className="login-logo">
                    <img src={NextermLogo} alt="Nexterm" />
                    <h1>Nexterm</h1>
                </div>
                {error && <div className="error">{error}</div>}
                <form className="login-form" onSubmit={submit}>
                    {!totpRequired && <>
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <Input type="text" id="username" required icon={mdiAccountCircleOutline}
                                   placeholder="Username" autoComplete="username"
                                   value={username} setValue={setUsername} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <Input type="password" id="password" required icon={mdiKeyOutline}
                                   placeholder="Password" autoComplete="current-password"
                                   value={password} setValue={setPassword} />
                        </div>
                    </>}
                    {totpRequired && <>
                        <div className="form-group">
                            <label htmlFor="code">2FA Code</label>
                            <Input type="number" id="code" required icon={mdiKeyOutline}
                                   placeholder="Code" autoComplete="one-time-code"
                                   value={code} setValue={setCode} />
                        </div>
                    </>}

                    <Button text="Login" />
                </form>
            </div>
        </DialogProvider>
    );
};