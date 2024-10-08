import Icon from "@mdi/react";
import { mdiAccount, mdiAccountRemove, mdiKey, mdiLogin, mdiSecurity } from "@mdi/js";
import { deleteRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { useContext, useState } from "react";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useNavigate } from "react-router-dom";

export const ContextMenu = ({ users, closeContextMenu, loadUsers, contextUserId, contextMenu }) => {

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
                                 text="This will permanently delete the user and all associated data." />
            <ActionConfirmDialog open={promoteDialogOpen} setOpen={setPromoteDialogOpen}
                                 onConfirm={() => updateRole(contextUserId, "admin")}
                                 text="This will promote the user to an admin." />
            <ActionConfirmDialog open={demoteDialogOpen} setOpen={setDemoteDialogOpen}
                                 onConfirm={() => updateRole(contextUserId, "user")}
                                 text="This will demote the user to a regular user." />

            <PasswordChange open={passwordChangeDialogOpen} onClose={() => setPasswordChangeDialogOpen(false)}
                            accountId={contextUserId} />

            {contextMenu.visible && <div
                className="context-menu"
                style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                onClick={(e) => e.stopPropagation()}>
                <div className="context-item" onClick={() => openPasswordChangeDialog()}>
                    <Icon path={mdiKey} />
                    <p>Change password</p>
                </div>

                {users.find(u => u.id === contextUserId).role === "user" && user.id !== contextUserId && (
                    <div className="context-item" onClick={() => openPromotionDialog()}>
                        <Icon path={mdiSecurity} />
                        <p>Promote to admin</p>
                    </div>
                )}

                {users.find(u => u.id === contextUserId).role === "admin" && user.id !== contextUserId && (
                    <div className="context-item" onClick={() => openDemotionDialog()}>
                        <Icon path={mdiAccount} />
                        <p>Demote to user</p>
                    </div>
                )}

                {user.id !== contextUserId && <div className="context-item" onClick={() => openDeletionDialog()}>
                    <Icon path={mdiAccountRemove} />
                    <p>Delete user</p>
                </div>}
                {user.id !== contextUserId && <div className="context-item" onClick={() => loginAsUser(contextUserId)}>
                    <Icon path={mdiLogin} />
                    <p>Login as user</p>
                </div>}
                    </div>}
            </>
                );
            }