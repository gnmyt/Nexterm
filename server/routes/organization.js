const express = require("express");
const logger = require("../utils/logger");
const app = express.Router();
const { authenticate } = require("../middlewares/auth");
const { validateSchema } = require("../utils/schema");
const organizationController = require("../controllers/organization");
const {
    createOrganizationSchema,
    updateOrganizationSchema,
    inviteUserSchema,
    respondToInvitationSchema,
} = require("../validations/organization");

/**
 * PUT /organization
 * @summary Create Organization
 * @description Creates a new organization with the authenticated user as the owner. Organizations allow multiple users to collaborate and share resources.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {CreateOrganizationSchema} request.body.required - Organization details including name and description
 * @return {object} 201 - Organization successfully created
 * @return {object} 400 - Invalid organization data
 */
app.put("/", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, createOrganizationSchema, req.body)) return;

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

/**
 * PATCH /organization/{id}
 * @summary Update Organization
 * @description Updates an existing organization's details such as name or description. Only organization owners can perform this action.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {UpdateOrganizationSchema} request.body.required - Updated organization details
 * @return {object} 200 - Organization successfully updated
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization not found
 */
app.patch("/:id", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, updateOrganizationSchema, req.body)) return;

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

/**
 * DELETE /organization/{id}
 * @summary Delete Organization
 * @description Permanently deletes an organization and all associated data. Only organization owners can perform this action.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Organization successfully deleted
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization not found
 */
app.delete("/:id", authenticate, async (req, res) => {
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

/**
 * GET /organization/{id}
 * @summary Get Organization Details
 * @description Retrieves detailed information about a specific organization, including its members and settings.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Organization details
 * @return {object} 403 - Access denied to organization
 * @return {object} 404 - Organization not found
 */
app.get("/:id", authenticate, async (req, res) => {
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

/**
 * GET /organization
 * @summary List Organizations
 * @description Retrieves a list of all organizations that the authenticated user is a member of or owns.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of organizations
 */
app.get("/", authenticate, async (req, res) => {
    try {
        const result = await organizationController.listOrganizations(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error("Error listing organizations", { error: error.message });
        res.status(500).json({ message: "An error occurred while listing organizations" });
    }
});

/**
 * GET /organization/{id}/members
 * @summary List Organization Members
 * @description Retrieves a list of all members in a specific organization, including their roles and status.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {array} 200 - List of organization members
 * @return {object} 403 - Access denied to organization
 * @return {object} 404 - Organization not found
 */
app.get("/:id/members", authenticate, async (req, res) => {
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

/**
 * POST /organization/{id}/invite
 * @summary Invite User to Organization
 * @description Sends an invitation to a user to join the organization. Only organization owners can send invitations.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {InviteUserSchema} request.body.required - Username of the user to invite
 * @return {object} 200 - Invitation successfully sent
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization or user not found
 */
app.post("/:id/invite", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, inviteUserSchema, req.body)) return;

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

/**
 * DELETE /organization/{id}/members/{accountId}
 * @summary Remove Organization Member
 * @description Removes a member from the organization. Only organization owners can remove members.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {string} accountId.path.required - The unique identifier of the member to remove
 * @return {object} 200 - Member successfully removed
 * @return {object} 403 - Insufficient permissions
 * @return {object} 404 - Organization or member not found
 */
app.delete("/:id/members/:accountId", authenticate, async (req, res) => {
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

/**
 * GET /organization/invitations/pending
 * @summary List Pending Invitations
 * @description Retrieves a list of all pending organization invitations for the authenticated user.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of pending invitations
 */
app.get("/invitations/pending", authenticate, async (req, res) => {
    try {
        const result = await organizationController.listPendingInvitations(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error("Error listing pending invitations", { error: error.message });
        res.status(500).json({ message: "An error occurred while listing pending invitations" });
    }
});

/**
 * POST /organization/invitations/{id}/respond
 * @summary Respond to Organization Invitation
 * @description Accepts or declines a pending organization invitation.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the invitation
 * @param {RespondToInvitationSchema} request.body.required - Response containing accept boolean value
 * @return {object} 200 - Response processed successfully
 * @return {object} 404 - Invitation not found
 */
app.post("/invitations/:id/respond", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, respondToInvitationSchema, req.body)) return;

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

/**
 * POST /organization/{id}/leave
 * @summary Leave Organization
 * @description Allows a user to leave an organization they are a member of. Organization owners cannot leave their own organization.
 * @tags Organization
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Successfully left organization
 * @return {object} 403 - Cannot leave organization (e.g., owner trying to leave)
 * @return {object} 404 - Organization not found
 */
app.post("/:id/leave", authenticate, async (req, res) => {
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