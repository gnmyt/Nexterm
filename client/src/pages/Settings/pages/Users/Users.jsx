import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest, deleteRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import {
    mdiAccount,
    mdiDotsVertical,
    mdiLock,
    mdiShieldAccount,
    mdiKey,
    mdiSecurity,
    mdiAccountRemove,
    mdiLogin,
    mdiPlus,
} from "@mdi/js";
import CreateUserDialog from "./components/CreateUserDialog";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const Users = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const { user, overrideToken } = useContext(UserContext);
    const navigate = useNavigate();

    const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
    const [contextUserId, setContextUserId] = useState(null);
    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
    const [demoteDialogOpen, setDemoteDialogOpen] = useState(false);
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);

    const contextMenu = useContextMenu();

    const loadUsers = () => {
        getRequest("users/list").then(response => {
            setUsers([...response]);
        });
    };

    const openContextMenu = (e, userId) => {
        e.stopPropagation();
        setContextUserId(userId);
        contextMenu.open(e);
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
    };

    const loginAsUser = (userId) => {
        postRequest(`users/${userId}/login`).then(response => {
            overrideToken(response.token);
            navigate("/servers");
        });
    };

    useEffect(() => {
        loadUsers();
    }, [user]);

    const contextUser = users.find(u => u.id === contextUserId);

    return (
        <div className="users-page">
            <CreateUserDialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)}
                              loadUsers={loadUsers} />

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

            <div className="users-header">
                <h2>{t("settings.users.title", { count: users.length })}</h2>
                <Button onClick={() => setCreateUserDialogOpen(true)} text={t("settings.users.createNewUser")} icon={mdiPlus} />
            </div>

            {users.length === 0 ? (
                <div className="no-users">
                    <Icon path={mdiAccount} />
                    <h2>{t("settings.users.noUsers")}</h2>
                    <p>{t("settings.users.noUsersDescription")}</p>
                </div>
            ) : (
                <div className="vertical-list">
                    {users.map(currentUser => (
                        <div key={currentUser.id} className="item">
                            <div className="left-section">
                                <div className={`icon ${currentUser.role === "admin" ? "primary" : "default"}`}>
                                    <Icon path={currentUser.role === "admin" ? mdiShieldAccount : mdiAccount} />
                                </div>
                                <div className="details">
                                    <h3>{currentUser.firstName} {currentUser.lastName}</h3>
                                    <p>@{currentUser.username}</p>
                                </div>
                            </div>
                            <div className="right-section">
                                <div className={`totp-badge ${currentUser.totpEnabled ? "enabled" : "disabled"}`}>
                                    <Icon path={mdiLock} />
                                    <span>{currentUser.totpEnabled ? t("settings.users.twoFactorEnabled") : t("settings.users.twoFactorDisabled")}</span>
                                </div>
                                <Icon 
                                    path={mdiDotsVertical} 
                                    className="menu-trigger" 
                                    onClick={(e) => openContextMenu(e, currentUser.id)} 
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                onClose={contextMenu.close}
                trigger={contextMenu.triggerRef}
            >
                <ContextMenuItem
                    icon={mdiKey}
                    label={t("settings.users.contextMenu.changePassword")}
                    onClick={() => setPasswordChangeDialogOpen(true)}
                />

                {contextUser?.role === "user" && user.id !== contextUserId && (
                    <ContextMenuItem
                        icon={mdiSecurity}
                        label={t("settings.users.contextMenu.promoteToAdmin")}
                        onClick={() => setPromoteDialogOpen(true)}
                    />
                )}

                {contextUser?.role === "admin" && user.id !== contextUserId && (
                    <ContextMenuItem
                        icon={mdiAccount}
                        label={t("settings.users.contextMenu.demoteToUser")}
                        onClick={() => setDemoteDialogOpen(true)}
                    />
                )}

                {user.id !== contextUserId && (
                    <>
                        <ContextMenuItem
                            icon={mdiLogin}
                            label={t("settings.users.contextMenu.loginAsUser")}
                            onClick={() => loginAsUser(contextUserId)}
                        />
                        <ContextMenuItem
                            icon={mdiAccountRemove}
                            label={t("settings.users.contextMenu.deleteUser")}
                            onClick={() => setConfirmDeleteDialogOpen(true)}
                            danger
                        />
                    </>
                )}
            </ContextMenu>
        </div>
    );
};
