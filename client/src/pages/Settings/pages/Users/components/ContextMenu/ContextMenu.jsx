import Icon from "@mdi/react";
import { mdiAccount, mdiAccountRemove, mdiKey, mdiLogin, mdiSecurity } from "@mdi/js";
import { deleteRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useNavigate } from "react-router-dom";
import "./styles.sass";

export const ContextMenu = ({ users, closeContextMenu, loadUsers, contextUserId, contextMenu }) => {

    const { t } = useTranslation();
    const { user, overrideToken } = useContext(UserContext);

    const navigate = useNavigate();

    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
    const [demoteDialogOpen, setDemoteDialogOpen] = useState(false);
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);

    const openPromotionDialog = () => {
        closeContextMenu();
        setPromoteDialogOpen(true);
    };

    const openDemotionDialog = () => {
        closeContextMenu();
        setDemoteDialogOpen(true);
    };

    const openDeletionDialog = () => {
        closeContextMenu();
        setConfirmDeleteDialogOpen(true);
    };

    const openPasswordChangeDialog = () => {
        closeContextMenu();
        setPasswordChangeDialogOpen(true);
    };

    const deleteUser = (userId) => {
        deleteRequest(`users/${userId}`).then(() => {
            loadUsers();
        });
    };

    const updateRole = (userId, role) => {
        patchRequest(`users/${userId}/role`, { role: role }).then(() => {
            loadUsers();
        });

        closeContextMenu();
    };

    const loginAsUser = (userId) => {
        postRequest(`users/${userId}/login`).then(response => {
            overrideToken(response.token);
            navigate("/servers");
        });
    };

    return (
        <>
            <ActionConfirmDialog open={confirmDeleteDialogOpen} setOpen={setConfirmDeleteDialogOpen}
                                 onConfirm={() => deleteUser(contextUserId)}
                                 text={t("settings.users.contextMenu.deleteConfirm")} />
            <ActionConfirmDialog open={promoteDialogOpen} setOpen={setPromoteDialogOpen}
                                 onConfirm={() => updateRole(contextUserId, "admin")}
                                 text={t("settings.users.contextMenu.promoteConfirm")} />
            <ActionConfirmDialog open={demoteDialogOpen} setOpen={setDemoteDialogOpen}
                                 onConfirm={() => updateRole(contextUserId, "user")}
                                 text={t("settings.users.contextMenu.demoteConfirm")} />

            <PasswordChange open={passwordChangeDialogOpen} onClose={() => setPasswordChangeDialogOpen(false)}
                            accountId={contextUserId} />

            {contextMenu.visible && <div
                className="context-menu"
                style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                onClick={(e) => e.stopPropagation()}>
                <div className="context-item" onClick={() => openPasswordChangeDialog()}>
                    <Icon path={mdiKey} />
                    <p>{t("settings.users.contextMenu.changePassword")}</p>
                </div>

                {users.find(u => u.id === contextUserId).role === "user" && user.id !== contextUserId && (
                    <div className="context-item" onClick={() => openPromotionDialog()}>
                        <Icon path={mdiSecurity} />
                        <p>{t("settings.users.contextMenu.promoteToAdmin")}</p>
                    </div>
                )}

                {users.find(u => u.id === contextUserId).role === "admin" && user.id !== contextUserId && (
                    <div className="context-item" onClick={() => openDemotionDialog()}>
                        <Icon path={mdiAccount} />
                        <p>{t("settings.users.contextMenu.demoteToUser")}</p>
                    </div>
                )}

                {user.id !== contextUserId && <div className="context-item" onClick={() => openDeletionDialog()}>
                    <Icon path={mdiAccountRemove} />
                    <p>{t("settings.users.contextMenu.deleteUser")}</p>
                </div>}
                {user.id !== contextUserId && <div className="context-item" onClick={() => loginAsUser(contextUserId)}>
                    <Icon path={mdiLogin} />
                    <p>{t("settings.users.contextMenu.loginAsUser")}</p>
                </div>}
                    </div>}
            </>
                );
            }