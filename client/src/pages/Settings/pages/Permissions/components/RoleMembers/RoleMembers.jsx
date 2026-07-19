import "./styles.sass";
import { useState } from "react";
import Icon from "@mdi/react";
import { mdiAccount, mdiClose } from "@mdi/js";
import UserSearch from "@/common/components/UserSearch";
import { postRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { getFullName } from "@/common/utils/avatar.js";

export const RoleMembers = ({ groupId, members = [], onChanged }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [search, setSearch] = useState("");

    const addMember = async (user) => {
        try {
            await postRequest(`permissions/groups/${groupId}/members`, { accountId: user.id });
            setSearch("");
            onChanged?.();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        }
    };

    const removeMember = async (accountId) => {
        try {
            const res = await deleteRequest(`permissions/groups/${groupId}/members/${accountId}`);
            if (res?.code) throw new Error(res.message);
            onChanged?.();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        }
    };

    return (
        <div className="role-members">
            <UserSearch value={search} onChange={setSearch} onSelect={addMember}
                        excludeIds={members.map((m) => m.id)}
                        placeholder={t("settings.permissions.addMemberPlaceholder")} />

            <div className="member-list">
                {members.length === 0 ? (
                    <p className="empty">{t("settings.permissions.noMembers")}</p>
                ) : members.map((member) => (
                    <div className="member-row" key={member.id}>
                        <div className="member-icon"><Icon path={mdiAccount} /></div>
                        <div className="member-info">
                            {getFullName(member) && <span className="name">{getFullName(member)}</span>}
                            <span className="username">@{member.username}</span>
                        </div>
                        <Icon path={mdiClose} className="remove" onClick={() => removeMember(member.id)} />
                    </div>
                ))}
            </div>
        </div>
    );
};