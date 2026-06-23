import Icon from "@mdi/react";
import { useState } from "react";
import { mdiAccount, mdiShieldAccount, mdiShieldKeyOutline } from "@mdi/js";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import "./styles.sass";
import Button from "@/common/components/Button";
import MemberPermissionsDialog from "../MemberPermissionsDialog";

export const MemberList = ({ members, organizationId, isOwner, refreshMembers }) => {
    const { sendToast } = useToast();
    const { t } = useTranslation();
    const [permMember, setPermMember] = useState(null);

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
            <MemberPermissionsDialog open={!!permMember} onClose={() => setPermMember(null)}
                                     organizationId={organizationId} member={permMember} />

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
                        <div className="member-actions">
                            <Button text={t("settings.permissions.permissionsTab")} type="secondary"
                                    icon={mdiShieldKeyOutline} onClick={() => setPermMember(member)} />
                            <Button text="Remove" type="danger" onClick={() => handleRemoveMember(member.accountId)} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
