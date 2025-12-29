const Joi = require('joi');

const terminalSchema = Joi.object({
    fontFamily: Joi.string().max(200),
    fontSize: Joi.number().integer().min(10).max(32),
    cursorStyle: Joi.string().valid('block', 'underline', 'bar'),
    cursorBlink: Joi.boolean(),
    theme: Joi.string().max(50),
}).unknown(false);

const themeSchema = Joi.object({
    mode: Joi.string().valid('light', 'dark', 'auto', 'oled'),
    accentColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
}).unknown(false);

const filesSchema = Joi.object({
    showThumbnails: Joi.boolean(),
    defaultViewMode: Joi.string().valid('list', 'grid'),
    showHiddenFiles: Joi.boolean(),
    confirmBeforeDelete: Joi.boolean(),
    dragDropAction: Joi.string().valid('ask', 'copy', 'move'),
}).unknown(false);

const generalSchema = Joi.object({
    language: Joi.string().max(10),
}).unknown(false);

module.exports.preferencesValidation = Joi.object({
    terminal: terminalSchema,
    theme: themeSchema,
    files: filesSchema,
    general: generalSchema,
}).unknown(false);
