const express = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const logger = require("../utils/logger");
const app = express.Router();
const { authenticate } = require("../middlewares/auth");
const organizationController = require("../controllers/organization");
const permissionController = require("../controllers/permission");
const { requireOrgPermission, requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");
const { setPermissionsValidation } = require("../validations/permission");
const {
    createOrganizationSchema,
    updateOrganizationSchema,
    inviteUserSchema,
    respondToInvitationSchema,
    updateSessionSettingsSchema,
} = require("../validations/organization");

const organizationResponse = Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
    description: Joi.string().allow(null),
    auditSettings: Joi.object().unknown(true),
    sessionSettings: Joi.object().unknown(true),
}).unknown(true);

app.put("/", authenticate, requirePermission(Permission.ORGANIZATIONS_CREATE), route({
    summary: "Create organization",
    status: 201,
    description: "Creates a new organization with the authenticated user as the owner. Organizations allow multiple users to collaborate and share resources.",
    body: createOrganizationSchema,
    returns: organizationResponse,
}), async (req, res) => {
    try {
        const result = await organizationController.createOrganization(req.user.id, req.body);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.status(201).json(result);
    } catch (error) {
        logger.error("Error creating organization", { error: error.message, stack: error.stack });
        res.status(500).json({ message: "An error occurred while creating the organization" });
    }
});

app.patch("/:id", authenticate, route({
    summary: "Update organization",
    description: "Updates an existing organization's details such as name or description. Only organization owners can perform this action.",
    body: updateOrganizationSchema,
}), async (req, res) => {
    try {
        const result = await organizationController.updateOrganization(req.user.id, req.params.id, req.body);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error updating organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while updating the organization" });
    }
});

app.delete("/:id", authenticate, route({
    summary: "Delete organization",
    description: "Permanently deletes an organization and all associated data. Only organization owners can perform this action.",
}), async (req, res) => {
    try {
        const result = await organizationController.deleteOrganization(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error deleting organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while deleting the organization" });
    }
});

app.get("/:id", authenticate, route({
    summary: "Get organization details",
    description: "Retrieves detailed information about a specific organization, including its members and settings.",
}), async (req, res) => {
    try {
        const result = await organizationController.getOrganization(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error fetching organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while fetching the organization" });
    }
});

app.get("/", authenticate, route({
    summary: "List organizations",
    description: "Retrieves a list of all organizations that the authenticated user is a member of or owns.",
    returns: Joi.array().items(organizationResponse.keys({
        isOwner: Joi.boolean().required(),
        permissions: Joi.array().items(Joi.string()).required().description("Permissions of the account in this organization"),
    })),
}), async (req, res) => {
    try {
        const result = await organizationController.listOrganizations(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error("Error listing organizations", { error: error.message });
        res.status(500).json({ message: "An error occurred while listing organizations" });
    }
});

app.get("/:id/members", authenticate, route({
    summary: "List organization members",
    description: "Retrieves a list of all members in a specific organization, including their roles and status.",
    returns: Joi.array().items(Joi.object({
        accountId: Joi.number().integer().required(),
        username: Joi.string().required(),
        firstName: Joi.string(),
        lastName: Joi.string(),
        name: Joi.string(),
        avatarHash: Joi.string().allow(null),
        role: Joi.string().required(),
        status: Joi.string().valid("active", "pending").required(),
    })),
}), async (req, res) => {
    try {
        const result = await organizationController.listMembers(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error listing organization members", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while listing organization members" });
    }
});

app.post("/:id/invite", authenticate, route({
    summary: "Invite user to organization",
    description: "Sends an invitation to a user to join the organization. Only organization owners can send invitations.",
    body: inviteUserSchema,
}), async (req, res) => {
    try {
        const result = await organizationController.inviteUser(req.user.id, req.params.id, req.body.username);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error inviting user to organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while sending the invitation" });
    }
});

app.delete("/:id/members/:accountId", authenticate, route({
    summary: "Remove organization member",
    description: "Removes a member from the organization. Only organization owners can remove members.",
}), async (req, res) => {
    try {
        const result = await organizationController.removeMember(req.user.id, req.params.id, req.params.accountId);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error removing member from organization", { organizationId: req.params.id, accountId: req.params.accountId, error: error.message });
        res.status(500).json({ message: "An error occurred while removing the member" });
    }
});

app.get("/:id/members/:accountId/permissions",
    authenticate, requireOrgPermission(Permission.ORG_MEMBERS_MANAGE), route({
        summary: "Get member permissions",
        description: "Returns a member's organization permission overrides and their effective permissions.",
    }), async (req, res) => {
        try {
            res.json(await permissionController.getOrgMemberPermissions(req.params.id, req.params.accountId));
        } catch (error) {
            logger.error("Error getting member permissions", { error: error.message });
            res.status(500).json({ message: "An error occurred while reading member permissions" });
        }
    });

app.put("/:id/members/:accountId/permissions",
    authenticate, requireOrgPermission(Permission.ORG_MEMBERS_MANAGE), route({
        summary: "Set member permissions",
        description: "Updates a member's organization permission overrides.",
        body: setPermissionsValidation,
    }), async (req, res) => {
        try {
            const result = await permissionController.setOrgMemberPermissions(req.params.id, req.params.accountId, req.body.permissions, req.orgPermissions);
            if (result.code) return res.status(result.code).json(result);
            res.json(result);
        } catch (error) {
            logger.error("Error setting member permissions", { error: error.message });
            res.status(500).json({ message: "An error occurred while updating member permissions" });
        }
    });

app.get("/:id/session-settings", authenticate, requireOrgPermission(Permission.ORG_MANAGE), route({
    summary: "Get live session settings",
    description: "Returns the live session sharing configuration of an organization.",
}), async (req, res) => {
    try {
        res.json(await organizationController.getSessionSettings(req.params.id));
    } catch (error) {
        logger.error("Error getting session settings", { error: error.message });
        res.status(500).json({ message: "An error occurred while reading the session settings" });
    }
});

app.patch("/:id/session-settings", authenticate, requireOrgPermission(Permission.ORG_MANAGE), route({
    summary: "Update live session settings",
    description: "Updates the live session sharing configuration of an organization.",
    body: updateSessionSettingsSchema,
}), async (req, res) => {
    try {
        res.json(await organizationController.updateSessionSettings(req.params.id, req.body));
    } catch (error) {
        logger.error("Error updating session settings", { error: error.message });
        res.status(500).json({ message: "An error occurred while updating the session settings" });
    }
});

app.get("/invitations/pending", authenticate, route({
    summary: "List pending invitations",
    description: "Retrieves a list of all pending organization invitations for the authenticated user.",
    returns: objectList,
}), async (req, res) => {
    try {
        const result = await organizationController.listPendingInvitations(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error("Error listing pending invitations", { error: error.message });
        res.status(500).json({ message: "An error occurred while listing pending invitations" });
    }
});

app.post("/invitations/:id/respond", authenticate, route({
    summary: "Respond to organization invitation",
    description: "Accepts or declines a pending organization invitation.",
    body: respondToInvitationSchema,
}), async (req, res) => {
    try {
        const result = await organizationController.respondToInvitation(req.user.id, req.params.id, req.body.accept);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error responding to invitation", { invitationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while processing your response" });
    }
});

app.post("/:id/leave", authenticate, route({
    summary: "Leave organization",
    description: "Allows a user to leave an organization they are a member of. Organization owners cannot leave their own organization.",
}), async (req, res) => {
    try {
        const result = await organizationController.leaveOrganization(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        logger.error("Error leaving organization", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while leaving the organization" });
    }
});

module.exports = app;