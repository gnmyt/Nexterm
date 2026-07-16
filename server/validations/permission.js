const Joi = require("joi");

const triStateMap = Joi.object().pattern(
    Joi.string(),
    Joi.string().valid("allow", "deny", "neutral"),
);

module.exports.createGroupValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
});

module.exports.updateGroupValidation = Joi.object({
    name: Joi.string().min(1).max(50).optional(),
    color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
    sortOrder: Joi.number().integer().min(0).optional(),
});

module.exports.setPermissionsValidation = Joi.object({
    permissions: triStateMap.required(),
});

module.exports.addMemberValidation = Joi.object({
    accountId: Joi.number().integer().positive().required(),
});

module.exports.setGroupsValidation = Joi.object({
    groupIds: Joi.array().items(Joi.number().integer().positive()).required(),
});

module.exports.reorderGroupsValidation = Joi.object({
    order: Joi.array().items(Joi.number().integer().positive()).required(),
});
