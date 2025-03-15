import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest, postRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import Icon from "@mdi/react";
import { mdiCheckCircleOutline, mdiCloseCircleOutline, mdiDomain, mdiPlus } from "@mdi/js";
import Button from "@/common/components/Button";
import OrganizationDialog from "./components/OrganizationDialog";
import InviteMemberDialog from "./components/InviteMemberDialog";
import MemberList from "./components/MemberList";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import "./styles.sass";

export const Organizations = () => {
    const { user } = useContext(UserContext);
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

    const fetchOrganizations = async () => {
        try {
            const orgs = await getRequest("organizations");
            setOrganizations(orgs);
        } catch (error) {
            sendToast("Error", "Failed to load organizations");
        }
    };

    const fetchPendingInvitations = async () => {
        try {
            const invites = await getRequest("organizations/invitations/pending");
            setPendingInvitations(invites);
        } catch (error) {
            sendToast("Error", "Failed to load pending invitations");
        }
    };

    const fetchMembers = async (orgId) => {
        try {
            const response = await getRequest(`organizations/${orgId}/members`);
            setMembersByOrgId(prev => ({ ...prev, [orgId]: response }));
            return response;
        } catch (error) {
            sendToast("Error", "Failed to load organization members");
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
                sendToast("Success", "Invitation accepted");
                fetchOrganizations();
            } else {
                sendToast("Success", "Invitation declined");
            }
        } catch (error) {
            sendToast("Error", "Failed to process invitation");
        }
    };

    const handleOrgClick = async (org) => {
        if (expandedOrgId === org.id) {
            setExpandedOrgId(null);
        } else {
            setExpandedOrgId(org.id);
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
        return org.ownerId === user.id;
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
                    sendToast("Success", "Organization deleted successfully");
                    fetchOrganizations();
                    setExpandedOrgId(null);
                } catch (error) {
                    sendToast("Error", "Failed to delete organization");
                }
            },
            "This will permanently delete the organization and remove all members. This action cannot be undone.",
        );
    };

    const handleLeaveOrg = async (orgId, e) => {
        e.stopPropagation();
        showConfirmDialog(
            async () => {
                try {
                    await postRequest(`organizations/${orgId}/leave`);
                    sendToast("Success", "You have left the organization");
                    fetchOrganizations();
                    setExpandedOrgId(null);
                } catch (error) {
                    sendToast("Error", "Failed to leave organization");
                }
            },
            "Are you sure you want to leave this organization?",
        );
    };

    return (
        <div className="organizations-page">
            <div className="page-header">
                <h2>Your Organizations</h2>
                <Button text="Create Organization" icon={mdiPlus} onClick={() => setCreateDialogOpen(true)} />
            </div>

            {organizations.length === 0 ? (
                <div className="no-organizations">
                    <p>You don't have any organizations yet.</p>
                    <p>Create one to start collaborating with your team.</p>
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
                                            <Button text="Invite" onClick={(e) => handleInviteMember(org, e)} />
                                            <Button text="Delete" type="danger"
                                                    onClick={(e) => handleDeleteOrg(org.id, e)} />
                                        </>
                                    ) : (
                                        <Button text="Leave" type="danger" onClick={(e) => handleLeaveOrg(org.id, e)} />
                                    )}
                                </div>
                            </div>
                            {expandedOrgId === org.id && membersByOrgId[org.id] && (
                                <div className="organization-members">
                                    <MemberList members={membersByOrgId[org.id]} organizationId={org.id}
                                                isOwner={isOrgOwner(org)} refreshMembers={() => fetchMembers(org.id)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {pendingInvitations.length > 0 && (
                <div className="pending-invitations">
                    <h2>Pending Invitations</h2>
                    <div className="vertical-list">
                        {pendingInvitations.map((invite) => (
                            <div key={invite.id} className="item">
                                <div className="left-section">
                                    <div className="icon warning">
                                        <Icon path={mdiDomain} />
                                    </div>
                                    <div className="details">
                                        <h3>{invite.organization.name}</h3>
                                        <p>Invited by: {invite.invitedBy.name}</p>
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
                                    organization={selectedOrganization} />
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