import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import {
    mdiAccount,
    mdiDotsVertical,
    mdiLock,
    mdiShieldAccount,
} from "@mdi/js";
import CreateUserDialog from "./components/CreateUserDialog";
import ContextMenu from "./components/ContextMenu";
import { useTranslation } from "react-i18next";

export const Users = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const { user } = useContext(UserContext);

    const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
    const [contextUserId, setContextUserId] = useState(null);

    const loadUsers = () => {
        getRequest("users/list").then(response => {
            setUsers([...response]);
        });
    };

    const openContextMenu = (e, userId) => {
        e.stopPropagation();
        const buttonRect = e.currentTarget.getBoundingClientRect();
        setContextMenu(contextMenu => {
            if (contextMenu.visible && contextUserId === userId) {
                return { visible: false, x: 0, y: 0};
            }

            setContextUserId(userId);

            return { visible: true, x: buttonRect.x - 160, y: buttonRect.y + buttonRect.height };
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0 });
    };

    useEffect(() => {
        const handleClickOutside = () => closeContextMenu();
        window.addEventListener("click", handleClickOutside);

        return () => {
            window.removeEventListener("click", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        loadUsers();
    }, [user]);

    return (
        <div className="users-page">
            <CreateUserDialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)}
                                loadUsers={loadUsers} />

            <div className="user-title">
                <h2>{t("settings.users.title", { count: users.length })}</h2>
                <Button onClick={() => setCreateUserDialogOpen(true)} text={t("settings.users.createNewUser")} />
            </div>
            {users.map(currentUser => (
                <div key={currentUser.id} className="user-item">
                    <div className="user-name">
                        <Icon path={currentUser.role === "admin" ? mdiShieldAccount : mdiAccount} />
                        <h2>{currentUser.firstName} {currentUser.lastName}</h2>
                    </div>
                    <h2>{currentUser.username}</h2>
                    <div className={"totp" + (currentUser.totpEnabled ? " totp-enabled" : "")}>
                        <Icon path={mdiLock} />
                        <h2>{currentUser.totpEnabled ? t("settings.users.twoFactorEnabled") : t("settings.users.twoFactorDisabled")}</h2>
                    </div>
                    <Icon path={mdiDotsVertical} className="menu" onClick={(e) => openContextMenu(e, currentUser.id)} />
                </div>
            ))}

            <ContextMenu closeContextMenu={closeContextMenu} loadUsers={loadUsers}
                                                 contextUserId={contextUserId} users={users} contextMenu={contextMenu} />

        </div>
    );
};
