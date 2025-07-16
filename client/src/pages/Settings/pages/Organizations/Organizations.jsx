import { useEffect, useState } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest, postRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import Icon from "@mdi/react";
import { mdiCheckCircleOutline, mdiCloseCircleOutline, mdiDomain, mdiPlus, mdiShieldCheckOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import OrganizationDialog from "./components/OrganizationDialog";
import InviteMemberDialog from "./components/InviteMemberDialog";
import MemberList from "./components/MemberList";
import OrganizationAuditSettings from "./components/OrganizationAuditSettings";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const Organizations = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [organizations, setOrganizations] = useState([]);
    const [pendingInvitations, setPendingInvitations] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
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

    const isOrgOwner = (org) => {
        return org.isOwner;
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
                <h2>{t("settings.organizations.title")}</h2>
                <Button text={t("settings.organizations.createOrganization")} icon={mdiPlus} onClick={() => setCreateDialogOpen(true)} />
            </div>

            {organizations.length === 0 ? (
                <div className="no-organizations">
                    <p>{t("settings.organizations.noOrganizations")}</p>
                    <p>{t("settings.organizations.noOrganizationsDescription")}</p>
                </div>
            ) : (
                <div className="vertical-list">
                    {organizations.map((org) => (
                        <div key={org.id}>
                            <div
                                className={`item clickable ${expandedOrgId === org.id ? "expanded" : ""}`}
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
                                    {isOrgOwner(org) ? (
                                        <>
                                            <Button text={t("settings.organizations.invite")} onClick={(e) => handleInviteMember(org, e)} />
                                            <Button text={t("settings.organizations.delete")} type="danger"
                                                    onClick={(e) => handleDeleteOrg(org.id, e)} />
                                        </>
                                    ) : (
                                        <Button text={t("settings.organizations.leave")} type="danger" onClick={(e) => handleLeaveOrg(org.id, e)} />
                                    )}
                                </div>
                            </div>
                            {expandedOrgId === org.id && (
                                <div className="organization-members">
                                    <div className="tab-headers">
                                        <div
                                            className={`tab-header ${(activeTab[org.id] || "members") === "members" ? "active" : ""}`}
                                            onClick={() => setActiveTab(prev => ({ ...prev, [org.id]: "members" }))}>
                                            <Icon path={mdiDomain} />
                                            <span>{t("settings.organizations.members")}</span>
                                        </div>
                                        {isOrgOwner(org) && (
                                            <div
                                                className={`tab-header ${activeTab[org.id] === "audit" ? "active" : ""}`}
                                                onClick={() => setActiveTab(prev => ({ ...prev, [org.id]: "audit" }))}>
                                                <Icon path={mdiShieldCheckOutline} />
                                                <span>{t("settings.organizations.auditSettings")}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="tab-content">
                                        {(activeTab[org.id] || "members") === "members" && membersByOrgId[org.id] && (
                                            <MemberList members={membersByOrgId[org.id]} organizationId={org.id}
                                                        isOwner={isOrgOwner(org)}
                                                        refreshMembers={() => fetchMembers(org.id)} />
                                        )}

                                        {activeTab[org.id] === "audit" && isOrgOwner(org) && (
                                            <OrganizationAuditSettings organizationId={org.id}
                                                                       isOwner={isOrgOwner(org)} />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {pendingInvitations.length > 0 && (
                <div className="pending-invitations">
                    <h2>{t("settings.organizations.pendingInvitations")}</h2>
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
                                refreshOrganizations={fetchOrganizations} />

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