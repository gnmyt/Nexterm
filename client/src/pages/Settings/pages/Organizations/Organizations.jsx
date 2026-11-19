import { useEffect, useState, useContext } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest, postRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { Permission } from "@/common/utils/permissions.js";
import Icon from "@mdi/react";
import { mdiCheckCircleOutline, mdiCloseCircleOutline, mdiDomain, mdiMonitorShare, mdiPlus, mdiShieldCheckOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import OrganizationDialog from "./components/OrganizationDialog";
import InviteMemberDialog from "./components/InviteMemberDialog";
import MemberList from "./components/MemberList";
import OrganizationAuditSettings from "./components/OrganizationAuditSettings";
import OrganizationSessionSettings from "./components/OrganizationSessionSettings";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { useTranslation } from "react-i18next";
import "./styles.sass";
import { SettingsHeading } from "@/common/components/SettingsDialog/SettingsHeading.jsx";
import EmptyState from "@/common/components/EmptyState";
import { isDemoGuest } from "@/common/utils/demo.js";

export const Organizations = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const { loadServers } = useContext(ServerContext);
    const { hasPermission, user } = useContext(UserContext);
    const demoGuest = isDemoGuest(user);

    const [organizations, setOrganizations] = useState(null);
    const [pendingInvitations, setPendingInvitations] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editOrganization, setEditOrganization] = useState(null);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [selectedOrganization, setSelectedOrganization] = useState(null);
    const [expandedOrgId, setExpandedOrgId] = useState(null);
    const [membersByOrgId, setMembersByOrgId] = useState({});
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmText, setConfirmText] = useState("");
    const [activeTab, setActiveTab] = useState({});

    const fetchOrganizations = async () => {
        try {
            const orgs = await getRequest("organizations");
            setOrganizations(orgs);
        } catch (error) {
            setOrganizations([]);
        }
        await loadServers();
    };

    const fetchPendingInvitations = async () => {
        try {
            const invites = await getRequest("organizations/invitations/pending");
            setPendingInvitations(invites);
        } catch (error) {
            setPendingInvitations([]);
        }
    };

    const fetchMembers = async (orgId) => {
        try {
            const response = await getRequest(`organizations/${orgId}/members`);
            setMembersByOrgId(prev => ({ ...prev, [orgId]: response }));
            return response;
        } catch (error) {
            return [];
        }
    };

    useEffect(() => {
        fetchOrganizations();
        fetchPendingInvitations();
    }, []);

    const handleInvitationResponse = async (organizationId, accept) => {
        try {
            await postRequest(`organizations/invitations/${organizationId}/respond`, { accept });
            fetchPendingInvitations();
            if (accept) {
                sendToast("Success", t("common.messages.invitationAccepted"));
                fetchOrganizations();
            } else {
                sendToast("Success", t("common.messages.invitationDeclined"));
            }
        } catch (error) {
            sendToast("Error", t("common.messages.invitationError"));
        }
    };

    const handleOrgClick = async (org) => {
        if (demoGuest) return;
        if (expandedOrgId === org.id) {
            setExpandedOrgId(null);
            setActiveTab(prev => ({ ...prev, [org.id]: "members" }));
        } else {
            setExpandedOrgId(org.id);
            setActiveTab(prev => ({ ...prev, [org.id]: prev[org.id] || "members" }));
            if (!membersByOrgId[org.id]) {
                await fetchMembers(org.id);
            }
        }
    };

    const handleInviteMember = (org, e) => {
        e.stopPropagation();
        setSelectedOrganization(org);
        setInviteDialogOpen(true);
    };

    const handleEditOrg = (org, e) => {
        e.stopPropagation();
        setEditOrganization(org);
        setCreateDialogOpen(true);
    };

    const handleCreateOrg = () => {
        setEditOrganization(null);
        setCreateDialogOpen(true);
    };

    const showConfirmDialog = (action, text) => {
        setConfirmAction(() => action);
        setConfirmText(text);
        setConfirmDialogOpen(true);
    };

    const handleDeleteOrg = async (orgId, e) => {
        e.stopPropagation();
        showConfirmDialog(
            async () => {
                try {
                    await deleteRequest(`organizations/${orgId}`);
                    sendToast("Success", t("common.messages.organizationDeleted"));
                    fetchOrganizations();
                    setExpandedOrgId(null);
                } catch (error) {
                    sendToast("Error", t("common.messages.organizationDeleteError"));
                }
            },
            t("settings.organizations.deleteConfirmation"),
        );
    };

    const handleLeaveOrg = async (orgId, e) => {
        e.stopPropagation();
        showConfirmDialog(
            async () => {
                try {
                    await postRequest(`organizations/${orgId}/leave`);
                    sendToast("Success", t("common.messages.leftOrganization"));
                    fetchOrganizations();
                    setExpandedOrgId(null);
                } catch (error) {
                    sendToast("Error", t("common.messages.leaveOrganizationError"));
                }
            },
            t("settings.organizations.leaveConfirmation"),
        );
    };

    return (
        <div className="organizations-page">
            <div className="org-header">
                <SettingsHeading>{t("settings.organizations.title")}</SettingsHeading>
                {hasPermission(Permission.ORGANIZATIONS_CREATE) && (
                    <Button text={t("settings.organizations.createOrganization")} icon={mdiPlus} onClick={handleCreateOrg} />
                )}
            </div>

            <div className="vertical-list">
                {organizations === null ? null : organizations.length === 0 ? (
                    <EmptyState icon={mdiDomain} title={t("settings.organizations.noOrganizations")}
                                description={t("settings.organizations.noOrganizationsDescription")} />
                ) : organizations.map((org) => (
                    <div key={org.id}>
                        <div
                            className={`item${demoGuest ? "" : " clickable"} ${expandedOrgId === org.id ? "expanded" : ""}`}
                            onClick={() => handleOrgClick(org)}
                        >
                            <div className="left-section">
                                <div className="icon primary">
                                    <Icon path={mdiDomain} />
                                </div>
                                <div className="details">
                                    <h3>{org.name}</h3>
                                    {org.description && <p>{org.description}</p>}
                                </div>
                            </div>
                                <div className="right-section">
                                    {org.permissions?.includes(Permission.ORG_MEMBERS_MANAGE) && (
                                        <Button text={t("settings.organizations.invite")} onClick={(e) => handleInviteMember(org, e)} />
                                    )}
                                    {org.permissions?.includes(Permission.ORG_MANAGE) && (
                                        <Button text={t("settings.organizations.edit")} type="secondary"
                                                onClick={(e) => handleEditOrg(org, e)} />
                                    )}
                                    {org.permissions?.includes(Permission.ORG_DELETE) && (
                                        <Button text={t("settings.organizations.delete")} type="danger"
                                                onClick={(e) => handleDeleteOrg(org.id, e)} />
                                    )}
                                    {!org.isOwner && !demoGuest && (
                                        <Button text={t("settings.organizations.leave")} type="danger" onClick={(e) => handleLeaveOrg(org.id, e)} />
                                    )}
                                </div>
                            </div>
                            {expandedOrgId === org.id && (
                                <div className="organization-members">
                                    <TabSwitcher
                                        tabs={[
                                            { key: "members", label: t("settings.organizations.members"), icon: mdiDomain },
                                            ...(org.permissions?.includes(Permission.ORG_AUDIT_VIEW) ? [{ key: "audit", label: t("settings.organizations.auditSettings.auditSettingsTab"), icon: mdiShieldCheckOutline }] : []),
                                            ...(org.permissions?.includes(Permission.ORG_MANAGE) ? [{ key: "sessions", label: t("settings.organizations.sessionSettings.sessionSettingsTab"), icon: mdiMonitorShare }] : [])
                                        ]}
                                        activeTab={activeTab[org.id] || "members"}
                                        onTabChange={(tabKey) => setActiveTab(prev => ({ ...prev, [org.id]: tabKey }))}
                                        variant="flat"
                                    />

                                    <div className="tab-content">
                                        {(activeTab[org.id] || "members") === "members" && membersByOrgId[org.id] && (
                                            <MemberList members={membersByOrgId[org.id]} organizationId={org.id}
                                                        isOwner={org.permissions?.includes(Permission.ORG_MEMBERS_MANAGE)}
                                                        refreshMembers={() => fetchMembers(org.id)} />
                                        )}

                                        {activeTab[org.id] === "audit" && org.permissions?.includes(Permission.ORG_AUDIT_VIEW) && (
                                            <OrganizationAuditSettings organizationId={org.id}
                                                                       isOwner={org.permissions?.includes(Permission.ORG_AUDIT_VIEW)} />
                                        )}

                                        {activeTab[org.id] === "sessions" && org.permissions?.includes(Permission.ORG_MANAGE) && (
                                            <OrganizationSessionSettings organizationId={org.id} canManage />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                }
                </div>

            {pendingInvitations.length > 0 && (
                <div className="pending-invitations">
                    <SettingsHeading>{t("settings.organizations.pendingInvitations")}</SettingsHeading>
                    <div className="vertical-list">
                        {pendingInvitations.map((invite) => (
                            <div key={invite.id} className="item">
                                <div className="left-section">
                                    <div className="icon warning">
                                        <Icon path={mdiDomain} />
                                    </div>
                                    <div className="details">
                                        <h3>{invite.organization.name}</h3>
                                        <p>{t("settings.organizations.invitedBy", { name: invite.invitedBy.name })}</p>
                                    </div>
                                </div>
                                <div className="right-section">
                                    <Icon onClick={() => handleInvitationResponse(invite.organization.id, true)}
                                          path={mdiCheckCircleOutline} className="accept-icon" />
                                    <Icon onClick={() => handleInvitationResponse(invite.organization.id, false)}
                                          path={mdiCloseCircleOutline} className="decline-icon" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <OrganizationDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}
                                organization={editOrganization} refreshOrganizations={fetchOrganizations} />

            {selectedOrganization && (
                <InviteMemberDialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}
                                    organization={selectedOrganization}
                                    refreshMembers={() => fetchMembers(selectedOrganization.id)} />
            )}

            <ActionConfirmDialog open={confirmDialogOpen} setOpen={setConfirmDialogOpen} text={confirmText}
                                 onConfirm={() => {
                                     confirmAction();
                                     setConfirmDialogOpen(false);
                                 }}
            />
        </div>
    );
};