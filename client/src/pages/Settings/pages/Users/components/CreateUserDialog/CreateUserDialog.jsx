import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Input from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiKeyOutline } from "@mdi/js";
import { useEffect, useState } from "react";
import Button from "@/common/components/Button";
import { putRequest } from "@/common/utils/RequestUtil.js";

export const CreateUserDialog = ({open, onClose, loadUsers}) => {

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");

    const submit = async (event) => {
        event.preventDefault();

        try {
            const user = await putRequest("users", { firstName, lastName, username, password });
            if (user.code) throw new Error(user.message);

            loadUsers();

            onClose();
        } catch (error) {
            setError(error.message || "An error occurred");
        }
    }

    const onEnter = async (event) => {
        if (event.key === "Enter") {
            await submit(event);
        }
    }

    useEffect(() => {
        if (!open) {
            setFirstName("");
            setLastName("");
            setUsername("");
            setPassword("");
            setError("");
        }
    }, [open]);

    useEffect(() => {
        if (error) {
            setError("");
        }
    }, [firstName, lastName, username, password]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="user-creation-dialog" onKeyDown={onEnter}>
                <h2>Create new user</h2>
                {error && <div className="error">{error}</div>}
                <div className="register-name-row">
                    <div className="form-group">
                        <label htmlFor="firstName">First Name</label>
                        <Input type="text" id="firstName" required icon={mdiAccountCircleOutline}
                               placeholder="First name" autoComplete="given-name"
                               value={firstName} setValue={setFirstName} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastName">Last Name</label>
                        <Input type="text" id="lastName" required icon={mdiAccountCircleOutline}
                               placeholder="Last name" autoComplete="family-name"
                               value={lastName} setValue={setLastName} />
                    </div>
                </div>

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

                <div className="btn-area">
                    <Button text="Create" onClick={submit} />
                </div>
            </div>
        </DialogProvider>
    )
};