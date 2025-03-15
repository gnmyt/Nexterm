const express = require("express");
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

app.put("/", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, createOrganizationSchema, req.body)) return;

        const result = await organizationController.createOrganization(req.user.id, req.body);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error("Error creating organization:", error);
        res.status(500).json({ message: "An error occurred while creating the organization" });
    }
});

app.patch("/:id", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, updateOrganizationSchema, req.body)) return;

        const result = await organizationController.updateOrganization(req.user.id, req.params.id, req.body);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error updating organization:", error);
        res.status(500).json({ message: "An error occurred while updating the organization" });
    }
});

app.delete("/:id", authenticate, async (req, res) => {
    try {
        const result = await organizationController.deleteOrganization(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error deleting organization:", error);
        res.status(500).json({ message: "An error occurred while deleting the organization" });
    }
});

app.get("/:id", authenticate, async (req, res) => {
    try {
        const result = await organizationController.getOrganization(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error fetching organization:", error);
        res.status(500).json({ message: "An error occurred while fetching the organization" });
    }
});

app.get("/", authenticate, async (req, res) => {
    try {
        const result = await organizationController.listOrganizations(req.user.id);
        res.json(result);
    } catch (error) {
        console.error("Error listing organizations:", error);
        res.status(500).json({ message: "An error occurred while listing organizations" });
    }
});

app.get("/:id/members", authenticate, async (req, res) => {
    try {
        const result = await organizationController.listMembers(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error listing organization members:", error);
        res.status(500).json({ message: "An error occurred while listing organization members" });
    }
});

app.post("/:id/invite", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, inviteUserSchema, req.body)) return;

        const result = await organizationController.inviteUser(req.user.id, req.params.id, req.body.username);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error inviting user to organization:", error);
        res.status(500).json({ message: "An error occurred while sending the invitation" });
    }
});

app.delete("/:id/members/:accountId", authenticate, async (req, res) => {
    try {
        const result = await organizationController.removeMember(req.user.id, req.params.id, req.params.accountId);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error removing member from organization:", error);
        res.status(500).json({ message: "An error occurred while removing the member" });
    }
});

app.get("/invitations/pending", authenticate, async (req, res) => {
    try {
        const result = await organizationController.listPendingInvitations(req.user.id);
        res.json(result);
    } catch (error) {
        console.error("Error listing pending invitations:", error);
        res.status(500).json({ message: "An error occurred while listing pending invitations" });
    }
});

app.post("/invitations/:id/respond", authenticate, async (req, res) => {
    try {
        if (validateSchema(res, respondToInvitationSchema, req.body)) return;

        const result = await organizationController.respondToInvitation(req.user.id, req.params.id, req.body.accept);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error responding to invitation:", error);
        res.status(500).json({ message: "An error occurred while processing your response" });
    }
});

app.post("/:id/leave", authenticate, async (req, res) => {
    try {
        const result = await organizationController.leaveOrganization(req.user.id, req.params.id);

        if (result.code) {
            return res.status(result.code).json({ message: result.message });
        }

        res.json(result);
    } catch (error) {
        console.error("Error leaving organization:", error);
        res.status(500).json({ message: "An error occurred while leaving the organization" });
    }
});

module.exports = app;