const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Account = require("../models/Account");
const { Op } = require("sequelize");

module.exports.createOrganization = async (accountId, configuration) => {
    const organization = await Organization.create({
        name: configuration.name, description: configuration.description,
        ownerId: accountId,
    });

    const existingMembership = await OrganizationMember.findOne({
        where: { organizationId: organization.id, accountId: accountId },
    });

    if (!existingMembership) {
        await OrganizationMember.create({
            organizationId: organization.id, accountId: accountId, role: "owner",
            status: "active", invitedBy: accountId,
        });
    }

    return organization;
};

module.exports.deleteOrganization = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const organization = await Organization.findOne({
        where: { id: orgId, ownerId: accountId },
    });

    if (!organization) {
        return { code: 403, message: "You don't have permission to delete this organization or it doesn't exist" };
    }

    await OrganizationMember.destroy({ where: { organizationId } });

    await Organization.destroy({ where: { id: organizationId } });

    return { success: true };
};

module.exports.updateOrganization = async (accountId, organizationId, updates) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) {
        return { code: 400, message: "Invalid organization ID" };
    }

    const membership = await OrganizationMember.findOne({
        where: { organizationId: orgId, accountId, status: "active", role: "owner" },
    });

    if (!membership) {
        return { code: 403, message: "You don't have permission to update this organization" };
    }

    await Organization.update(updates, { where: { id: orgId } });

    return await Organization.findByPk(orgId);
};

module.exports.getOrganization = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const membership = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "active" } });

    if (!membership) {
        return { code: 403, message: "You don't have access to this organization" };
    }

    return await Organization.findByPk(orgId);
};

module.exports.listOrganizations = async (accountId) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });

    const organizationIds = memberships.map(m => m.organizationId);

    return await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });
};

module.exports.listPendingInvitations = async (accountId) => {
    const pendingInvites = await OrganizationMember.findAll({ where: { accountId, status: "pending" } });

    const organizationIds = pendingInvites.map(invite => invite.organizationId);

    const organizations = await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });

    const inviterIds = [...new Set(pendingInvites.map(invite => invite.invitedBy))];
    const inviters = await Account.findAll({
        where: { id: { [Op.in]: inviterIds } },
        attributes: ["id", "firstName", "lastName", "username"],
    });

    return pendingInvites.map(invite => {
        const org = organizations.find(o => o.id === invite.organizationId);
        const inviter = inviters.find(i => i.id === invite.invitedBy);

        return {
            id: invite.id,
            organization: { id: org.id, name: org.name, description: org.description },
            invitedBy: {
                id: inviter.id,
                name: `${inviter.firstName} ${inviter.lastName}`,
                username: inviter.username,
            },
            createdAt: invite.createdAt,
        };
    });
};

module.exports.inviteUser = async (accountId, organizationId, username) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const membership = await OrganizationMember.findOne({
        where: { organizationId: orgId, accountId, status: "active", role: "owner" },
    });

    if (!membership) return { code: 403, message: "You don't have permission to invite users to this organization" };
    const invitedUser = await Account.findOne({ where: { username: username } });

    if (!invitedUser) return { code: 404, message: "User not found" };

    const existingMembership = await OrganizationMember.findOne({
        where: { organizationId: orgId, accountId: invitedUser.id },
    });

    if (existingMembership) {
        if (existingMembership.status === "active") {
            return { code: 409, message: "User is already a member of this organization" };
        } else {
            return { code: 409, message: "User already has a pending invitation" };
        }
    }

    await OrganizationMember.create({
        organizationId: orgId, accountId: invitedUser.id, role: "member",
        status: "pending", invitedBy: accountId,
    });

    return { success: true, message: "Invitation sent successfully" };
};

module.exports.respondToInvitation = async (accountId, organizationId, accept) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const invitation = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "pending" } });

    if (!invitation) return { code: 404, message: "Invitation not found" };

    if (accept) {
        await OrganizationMember.update({ status: "active" }, { where: { organizationId: orgId, accountId } });
        return { success: true, message: "Invitation accepted" };
    } else {
        await OrganizationMember.destroy({ where: { organizationId: orgId, accountId } });
        return { success: true, message: "Invitation declined" };
    }
};

module.exports.removeMember = async (accountId, organizationId, memberAccountId) => {
    const orgId = parseInt(organizationId, 10);
    const memberId = parseInt(memberAccountId, 10);

    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };
    if (isNaN(memberId) || memberId <= 0) return { code: 400, message: "Invalid member account ID" };

    const membership = await OrganizationMember.findOne({
        where: { organizationId: orgId, accountId, status: "active", role: "owner" },
    });

    if (!membership) {
        return { code: 403, message: "You don't have permission to remove members from this organization" };
    }

    const memberToRemove = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId: memberId } });

    if (!memberToRemove) {
        return { code: 404, message: "Member not found in this organization" };
    }

    if (memberToRemove.role === "owner") {
        return { code: 403, message: "Cannot remove the organization owner" };
    }


    await OrganizationMember.destroy({ where: { organizationId: orgId, accountId: memberId } });

    return { success: true, message: "Member removed successfully" };
};

module.exports.listMembers = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };
    const membership = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "active" } });

    if (!membership) {
        return { code: 403, message: "You don't have access to this organization" };
    }

    const members = await OrganizationMember.findAll({ where: { organizationId: orgId } });

    const memberAccountIds = members.map(m => m.accountId);
    const accounts = await Account.findAll({
        where: { id: { [Op.in]: memberAccountIds } },
        attributes: ["id", "firstName", "lastName", "username"],
    });

    return members.map(member => {
        const account = accounts.find(a => a.id === member.accountId);

        return {
            id: member.id, accountId: account.id, name: `${account.firstName} ${account.lastName}`,
            username: account.username, role: member.role, status: member.status,
        };
    });
};

module.exports.leaveOrganization = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId) || orgId <= 0) return { code: 400, message: "Invalid organization ID" };

    const membership = await OrganizationMember.findOne({ where: { organizationId: orgId, accountId, status: "active" } });

    if (!membership) {
        return { code: 404, message: "You are not a member of this organization" };
    }

    if (membership.role === "owner") {
        return { code: 403, message: "As the owner, you cannot leave the organization. You must delete it instead" };
    }

    await OrganizationMember.destroy({ where: { organizationId: orgId, accountId } });

    return { success: true, message: "You have left the organization" };
};