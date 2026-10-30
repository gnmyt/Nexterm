const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { createSshCaValidation, updateSshCaValidation } = require("../validations/sshCertificateAuthority");
const {
    listCertificateAuthorities,
    createCertificateAuthority,
    updateCertificateAuthority,
    deleteCertificateAuthority,
} = require("../controllers/sshCertificateAuthority");

const app = Router();

const send = (res, result) => {
    if (result?.code) return res.status(result.code).json({ code: result.code, message: result.message });
    return res.json(result);
};

/**
 * GET /ssh-cas
 * @summary List SSH certificate authorities
 * @tags SSH Certificates
 * @security BearerAuth
 * @return {array} 200 - Certificate authorities visible to the caller
 */
app.get("/", async (req, res) => {
    res.json(await listCertificateAuthorities(req.user.id));
});

/**
 * POST /ssh-cas
 * @summary Create an SSH certificate authority
 * @tags SSH Certificates
 * @security BearerAuth
 * @return {object} 200 - Created authority
 * @return {object} 400 - Invalid configuration
 */
app.post("/", async (req, res) => {
    if (validateSchema(res, createSshCaValidation, req.body)) return;
    return send(res, await createCertificateAuthority(req.user.id, req.body));
});

/**
 * PATCH /ssh-cas/{id}
 * @summary Update an SSH certificate authority
 * @tags SSH Certificates
 * @security BearerAuth
 * @return {object} 200 - Updated authority
 */
app.patch("/:id", async (req, res) => {
    if (validateSchema(res, updateSshCaValidation, req.body)) return;
    return send(res, await updateCertificateAuthority(req.user.id, req.params.id, req.body));
});

/**
 * DELETE /ssh-cas/{id}
 * @summary Delete an SSH certificate authority
 * @tags SSH Certificates
 * @security BearerAuth
 * @return {object} 200 - Authority deleted
 */
app.delete("/:id", async (req, res) => send(res, await deleteCertificateAuthority(req.user.id, req.params.id)));

module.exports = app;
