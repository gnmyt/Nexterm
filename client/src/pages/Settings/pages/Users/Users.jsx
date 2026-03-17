import "./styles.sass";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest, deleteRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import PaginatedTable from "@/common/components/PaginatedTable";
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
    mdiMagnify,
    mdiAccountCircleOutline,
} from "@mdi/js";
import CreateUserDialog from "./components/CreateUserDialog";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ITEMS_PER_PAGE = 25;

export const Users = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const { user, overrideToken } = useContext(UserContext);
    const navigate = useNavigate();

    const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
    const [contextUserId, setContextUserId] = useState(null);
    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
    const [demoteDialogOpen, setDemoteDialogOpen] = useState(false);
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);

    const contextMenu = useContextMenu();

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const offset = (currentPage - 1) * ITEMS_PER_PAGE;
            const params = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: offset.toString(),
            });
            if (debouncedSearch) {
                params.set("search", debouncedSearch);
            }
            const response = await getRequest(`users/list?${params}`);
            setUsers(response.users || []);
            setTotal(response.total || 0);
        } catch (error) {
            setUsers([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [currentPage, debouncedSearch]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

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

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const pagination = useMemo(() => ({
        total,
        currentPage,
        itemsPerPage: ITEMS_PER_PAGE,
    }), [total, currentPage]);

    const contextUser = users.find(u => u.id === contextUserId);

    const columns = useMemo(() => [
        {
            key: "user",
            label: t("settings.users.table.user"),
            icon: mdiAccountCircleOutline,
            className: "user-cell-wrapper",
            render: (currentUser) => (
                <div className="user-cell">
                    <div className={`user-icon ${currentUser.role === "admin" ? "primary" : "default"}`}>
                        <Icon path={currentUser.role === "admin" ? mdiShieldAccount : mdiAccount} />
                    </div>
                    <div className="user-info">
                        <span className="name">{currentUser.firstName} {currentUser.lastName}</span>
                        <span className="username">@{currentUser.username}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "role",
            label: t("settings.users.table.role"),
            icon: mdiShieldAccount,
            mobileLabel: t("settings.users.table.role"),
            render: (currentUser) => (
                <span className={`role-badge ${currentUser.role}`}>
                    {currentUser.role === "admin" ? t("settings.users.roles.admin") : t("settings.users.roles.user")}
                </span>
            ),
        },
        {
            key: "totp",
            label: t("settings.users.table.twoFactor"),
            icon: mdiLock,
            mobileLabel: t("settings.users.table.twoFactor"),
            render: (currentUser) => (
                <div className={`totp-badge ${currentUser.totpEnabled ? "enabled" : "disabled"}`}>
                    <Icon path={mdiLock} />
                    <span>{currentUser.totpEnabled ? t("settings.users.twoFactorEnabled") : t("settings.users.twoFactorDisabled")}</span>
                </div>
            ),
        },
        {
            key: "actions",
            label: "",
            className: "actions-cell",
            render: (currentUser) => (
                <Icon
                    path={mdiDotsVertical}
                    className="menu-trigger"
                    onClick={(e) => openContextMenu(e, currentUser.id)}
                />
            ),
        },
    ], [t]);

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
                <h2>{t("settings.users.title", { count: total })}</h2>
                <div className="header-actions">
                    <div className="search-box">
                        <Icon path={mdiMagnify} />
                        <input
                            type="text"
                            placeholder={t("settings.users.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setCreateUserDialogOpen(true)} text={t("settings.users.createNewUser")} icon={mdiPlus} />
                </div>
            </div>

            <PaginatedTable
                data={users}
                columns={columns}
                pagination={pagination}
                onPageChange={handlePageChange}
                getRowKey={(user) => user.id}
                loading={loading}
                emptyState={{
                    icon: mdiAccount,
                    title: debouncedSearch ? t("settings.users.noSearchResults") : t("settings.users.noUsers"),
                    subtitle: debouncedSearch ? t("settings.users.noSearchResultsDescription") : t("settings.users.noUsersDescription"),
                }}
            />

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

                {contextUser?.role === "user" && user?.id !== contextUserId && (
                    <ContextMenuItem
                        icon={mdiSecurity}
                        label={t("settings.users.contextMenu.promoteToAdmin")}
                        onClick={() => setPromoteDialogOpen(true)}
                    />
                )}

                {contextUser?.role === "admin" && user?.id !== contextUserId && (
                    <ContextMenuItem
                        icon={mdiAccount}
                        label={t("settings.users.contextMenu.demoteToUser")}
                        onClick={() => setDemoteDialogOpen(true)}
                    />
                )}

                {user?.id !== contextUserId && (
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
