import { useEffect, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import UserSearch from "@/common/components/UserSearch";
import Button from "@/common/components/Button";
import { postRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

export const InviteMemberDialog = ({ open, onClose, organization, refreshMembers }) => {
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
            refreshMembers();

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
                        <UserSearch 
                            id="invite-username"
                            value={username}
                            onChange={setUsername}
                            onSelect={(user) => setUsername(user.username)}
                            placeholder="Search for a user to invite..."
                            required
                        />
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