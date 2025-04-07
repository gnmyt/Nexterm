import Icon from "@mdi/react";
import { mdiAccount, mdiShieldAccount } from "@mdi/js";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "./styles.sass";
import Button from "@/common/components/Button/index.js";

export const MemberList = ({ members, organizationId, isOwner, refreshMembers }) => {
    const { sendToast } = useToast();

    const handleRemoveMember = async (accountId) => {
        try {
            await deleteRequest(`organizations/${organizationId}/members/${accountId}`);
            sendToast("Success", "Member removed successfully");
            refreshMembers();
        } catch (error) {
            sendToast("Error", error.message || "Failed to remove member");
        }
    };

    return (
        <div className="member-list">
            {members.map((member) => (
                <div key={member.accountId} className="member-item">
                    <div className="member-info">
                        <Icon
                            path={member.role === "owner" || member.role === "admin" ? mdiShieldAccount : mdiAccount} />
                        <div className="member-details">
                            <h3>{member.name}</h3>
                            <p>{member.username}</p>
                        </div>
                        <span className="member-role">{member.role}</span>
                    </div>
                    {isOwner && member.role !== "owner" && (
                        <Button text="Remove" onClick={() => handleRemoveMember(member.accountId)} />
                    )}
                </div>
            ))}
        </div>
    );
};