import { useEffect, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import IconInput from "@/common/components/IconInput";
import { mdiAccount } from "@mdi/js";
import Button from "@/common/components/Button";
import { postRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

export const InviteMemberDialog = ({ open, onClose, organization }) => {
    const { sendToast } = useToast();
    const [username, setUsername] = useState("");

    const handleInvite = async (e) => {
        e.preventDefault();

        if (!username.trim()) {
            sendToast("Error", "Username is required");
            return;
        }

        try {
            await postRequest(`organizations/${organization.id}/invite`, {
                username: username.trim(),
            });

            sendToast("Success", "Invitation sent successfully");
            onClose();
        } catch (error) {
            sendToast("Error", error.message || "Failed to send invitation");
        }
    };

    useEffect(() => {
        if (open) {
            setUsername("");
        }
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="invite-member-dialog">
                <h2>Invite Member</h2>
                <p className="subtitle">Invite a user to join {organization.name}</p>

                <form onSubmit={handleInvite}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <IconInput icon={mdiAccount} id="username" placeholder="Enter username"
                                   value={username} setValue={setUsername} required />
                    </div>

                    <div className="dialog-actions">
                        <Button text="Cancel" onClick={onClose} type="secondary" buttonType="button" />
                        <Button text="Send Invitation" type="primary" buttonType="submit" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};