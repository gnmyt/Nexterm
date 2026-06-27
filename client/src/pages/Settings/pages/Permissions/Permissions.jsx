import "./styles.sass";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import Icon from "@mdi/react";
import {
    mdiAccountMultipleOutline, mdiChevronDown, mdiPlus, mdiShieldAccount, mdiShieldKeyOutline,
    mdiShieldCrownOutline, mdiTrashCanOutline, mdiMagnify, mdiAccount, mdiCogOutline, mdiAccountGroup,
    mdiDragVertical,
} from "@mdi/js";
import { getRequest, patchRequest, deleteRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import PermissionMatrix from "@/common/components/PermissionMatrix";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import CreateRoleDialog from "./components/CreateRoleDialog";
import RoleMembers from "./components/RoleMembers";
import UserPermissionsDialog from "./components/UserPermissionsDialog";
import { PRESET_COLORS } from "./constants";

const RoleRow = ({ group, draggable, onReorder, children }) => {
    const [{ isDragging }, drag, preview] = useDrag({
        type: "role",
        item: { id: group.id },
        canDrag: draggable,
        collect: (m) => ({ isDragging: m.isDragging() }),
    });
    const [{ isOver }, drop] = useDrop({
        accept: "role",
        canDrop: () => draggable,
        drop: (item) => item.id !== group.id && onReorder(item.id, group.id),
        collect: (m) => ({ isOver: m.isOver() && m.getItem()?.id !== group.id }),
    });

    return (
        <div ref={(node) => drop(preview(node))}
             className={`role-item-wrapper${isDragging ? " dragging" : ""}${isOver ? " drop-target" : ""}`}>
            {children(drag)}
        </div>
    );
};

export const Permissions = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [catalog, setCatalog] = useState(null);
    const [groups, setGroups] = useState([]);
    const [activeTab, setActiveTab] = useState("roles");

    const [expandedId, setExpandedId] = useState(null);
    const [groupTab, setGroupTab] = useState({});
    const [details, setDetails] = useState({});
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [permUserId, setPermUserId] = useState(null);
    const [permDialogOpen, setPermDialogOpen] = useState(false);

    const loadGroups = useCallback(async () => {
        try {
            setGroups(await getRequest("permissions/groups"));
        } catch {
            sendToast("Error", t("settings.permissions.loadError"));
        }
    }, []);

    useEffect(() => {
        getRequest("permissions/catalog").then((res) => setCatalog(res.system)).catch(() => {});
        loadGroups();
    }, [loadGroups]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(userSearch), 300);
        return () => clearTimeout(timer);
    }, [userSearch]);

    const loadUsers = useCallback(async () => {
        try {
            const params = new URLSearchParams({ limit: "100" });
            if (debouncedSearch) params.set("search", debouncedSearch);
            const res = await getRequest(`users/list?${params}`);
            setUsers(res.users || []);
        } catch {
            setUsers([]);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        if (activeTab === "members") loadUsers();
    }, [activeTab, loadUsers]);

    const loadDetail = async (groupId) => {
        try {
            const detail = await getRequest(`permissions/groups/${groupId}`);
            setDetails((prev) => ({ ...prev, [groupId]: detail }));
        } catch {
            sendToast("Error", t("settings.permissions.loadError"));
        }
    };

    const toggleExpand = async (group) => {
        if (expandedId === group.id) return setExpandedId(null);
        setExpandedId(group.id);
        setGroupTab((prev) => ({ ...prev, [group.id]: prev[group.id] || "permissions" }));
        if (!details[group.id]) await loadDetail(group.id);
    };

    const changePermission = async (group, permId, value) => {
        const current = details[group.id]?.permissions || {};
        const next = { ...current, [permId]: value };
        setDetails((prev) => ({ ...prev, [group.id]: { ...prev[group.id], permissions: next } }));
        try {
            await putRequest(`permissions/groups/${group.id}/permissions`, { permissions: next });
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        }
    };

    const renameGroup = async (group, name) => {
        if (!name.trim() || name === group.name) return;
        try {
            await patchRequest(`permissions/groups/${group.id}`, { name: name.trim() });
            loadGroups();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        }
    };

    const changeColor = async (group, color) => {
        if (color === group.color) return;
        try {
            await patchRequest(`permissions/groups/${group.id}`, { color });
            loadGroups();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await deleteRequest(`permissions/groups/${deleteTarget.id}`);
            if (res?.code) throw new Error(res.message);
            setExpandedId(null);
            loadGroups();
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
        } finally {
            setDeleteTarget(null);
        }
    };

    const groupIcon = (group) => group.isAdmin ? mdiShieldCrownOutline : group.isDefault ? mdiAccountGroup : mdiShieldAccount;

    const customGroups = useMemo(
        () => groups.filter((g) => !g.isAdmin && !g.isDefault).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
        [groups]);

    // Display order mirrors priority: Administrator on top, custom roles by priority, Default (baseline) last.
    const orderedGroups = useMemo(() => [
        ...groups.filter((g) => g.isAdmin),
        ...customGroups,
        ...groups.filter((g) => g.isDefault && !g.isAdmin),
    ], [groups, customGroups]);

    const reorderRoles = async (sourceId, targetId) => {
        const ids = customGroups.map((g) => g.id);
        const from = ids.indexOf(sourceId);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1 || from === to) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);

        const orderMap = new Map(ids.map((id, i) => [id, i + 1]));
        setGroups((prev) => prev.map((g) => orderMap.has(g.id) ? { ...g, sortOrder: orderMap.get(g.id) } : g));
        try {
            await putRequest("permissions/groups/order", { order: ids });
        } catch (error) {
            sendToast("Error", error.message || t("settings.permissions.saveError"));
            loadGroups();
        }
    };

    const tabs = useMemo(() => [
        { key: "roles", label: t("settings.permissions.rolesTitle"), icon: mdiShieldKeyOutline },
        { key: "members", label: t("settings.permissions.membersTitle"), icon: mdiAccountMultipleOutline },
    ], [t]);

    return (
        <div className="permissions-page">
            <CreateRoleDialog open={createOpen} onClose={() => setCreateOpen(false)}
                              onCreated={() => loadGroups()} />
            <ActionConfirmDialog open={!!deleteTarget} setOpen={(v) => !v && setDeleteTarget(null)}
                                 onConfirm={confirmDelete}
                                 text={t("settings.permissions.deleteConfirm", { name: deleteTarget?.name })} />
            <UserPermissionsDialog open={permDialogOpen} onClose={() => setPermDialogOpen(false)}
                                   accountId={permUserId} groups={groups} catalog={catalog}
                                   onSaved={() => { loadUsers(); }} />

            <div className="permissions-header">
                <div>
                    <h2>{t("settings.pages.permissions")}</h2>
                    <p>{t("settings.permissions.subtitle")}</p>
                </div>
                {activeTab === "roles" && (
                    <Button text={t("settings.permissions.createRole")} icon={mdiPlus} onClick={() => setCreateOpen(true)} />
                )}
            </div>

            <TabSwitcher tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} variant="flat" />

            {activeTab === "roles" && (
                <div className="vertical-list">
                    {orderedGroups.map((group) => {
                        const detail = details[group.id];
                        const subTab = groupTab[group.id] || "permissions";
                        const draggable = !group.isAdmin && !group.isDefault;
                        return (
                            <RoleRow key={group.id} group={group} draggable={draggable} onReorder={reorderRoles}>
                                {(dragRef) => (<>
                                <div ref={draggable ? dragRef : undefined}
                                     className={`item clickable ${draggable ? "draggable" : ""} ${expandedId === group.id ? "expanded" : ""}`}
                                     onClick={() => toggleExpand(group)}>
                                    {draggable && <span className="drag-handle"><Icon path={mdiDragVertical} /></span>}
                                    <div className="left-section">
                                        <div className="role-icon" style={{ backgroundColor: `${group.color}26`, color: group.color }}>
                                            <Icon path={groupIcon(group)} />
                                        </div>
                                        <div className="details">
                                            <h3>{group.name}</h3>
                                            <p>{t("settings.permissions.memberCount", { count: group.memberCount })}</p>
                                        </div>
                                    </div>
                                    <div className="right-section">
                                        <Icon path={mdiChevronDown} className={`chevron ${expandedId === group.id ? "open" : ""}`} />
                                    </div>
                                </div>

                                {expandedId === group.id && (
                                    <div className="role-expanded">
                                        <TabSwitcher
                                            tabs={[
                                                { key: "permissions", label: t("settings.permissions.permissionsTab"), icon: mdiShieldKeyOutline },
                                                { key: "members", label: t("settings.permissions.membersTab"), icon: mdiAccountMultipleOutline },
                                                ...(!group.isSystem ? [{ key: "settings", label: t("settings.permissions.settingsTab"), icon: mdiCogOutline }] : []),
                                            ]}
                                            activeTab={subTab}
                                            onTabChange={(key) => setGroupTab((prev) => ({ ...prev, [group.id]: key }))}
                                            variant="flat"
                                        />

                                        <div className="role-tab-content">
                                            {subTab === "permissions" && (
                                                group.isAdmin ? (
                                                    <PermissionMatrix catalog={catalog} readOnly
                                                                      granted={(catalog?.permissions || []).map((p) => p.id)} />
                                                ) : (
                                                    <PermissionMatrix catalog={catalog}
                                                                      values={detail?.permissions || {}}
                                                                      onChange={(permId, value) => changePermission(group, permId, value)} />
                                                )
                                            )}

                                            {subTab === "members" && detail && (
                                                <RoleMembers groupId={group.id} members={detail.members || []}
                                                             onChanged={() => { loadDetail(group.id); loadGroups(); }} />
                                            )}

                                            {subTab === "settings" && !group.isSystem && (
                                                <div className="role-settings">
                                                    <div className="settings-field">
                                                        <label>{t("settings.permissions.roleName")}</label>
                                                        <input className="text-input" defaultValue={group.name}
                                                               onBlur={(e) => renameGroup(group, e.target.value)} />
                                                    </div>
                                                    <div className="settings-field">
                                                        <label>{t("settings.permissions.roleColor")}</label>
                                                        <div className="color-swatches">
                                                            {PRESET_COLORS.map((c) => (
                                                                <button key={c} type="button" style={{ backgroundColor: c }}
                                                                        className={`swatch ${group.color === c ? "selected" : ""}`}
                                                                        onClick={() => changeColor(group, c)} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="delete-row">
                                                        <Button text={t("settings.permissions.deleteRole")} icon={mdiTrashCanOutline}
                                                                type="danger" onClick={() => setDeleteTarget(group)} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                </>)}
                            </RoleRow>
                        );
                    })}
                </div>
            )}

            {activeTab === "members" && (
                <>
                    <div className="search-box">
                        <Icon path={mdiMagnify} />
                        <input type="text" placeholder={t("settings.permissions.searchUsers")}
                               value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                    </div>

                    <div className="vertical-list">
                        {users.map((user) => (
                            <div key={user.id} className="item clickable"
                                 onClick={() => { setPermUserId(user.id); setPermDialogOpen(true); }}>
                                <div className="left-section">
                                    <div className={`role-icon ${user.isAdmin ? "is-admin" : ""}`}>
                                        <Icon path={user.isAdmin ? mdiShieldAccount : mdiAccount} />
                                    </div>
                                    <div className="details">
                                        <h3>{user.firstName} {user.lastName}</h3>
                                        <p>@{user.username}</p>
                                    </div>
                                </div>
                                <div className="right-section role-chips">
                                    {(user.groups || []).map((g) => (
                                        <span key={g.id} className="mini-chip" style={{ backgroundColor: `${g.color}26`, color: g.color }}>
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};