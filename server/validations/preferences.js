const Joi = require('joi');

const terminalSchema = Joi.object({
    fontFamily: Joi.string().max(200),
    fontSize: Joi.number().integer().min(10).max(32),
    cursorStyle: Joi.string().valid('block', 'underline', 'bar'),
    cursorBlink: Joi.boolean(),
    smartCopyPaste: Joi.boolean(),
    autoReconnect: Joi.boolean(),
    copyPasteBehavior: Joi.string().valid('none', 'smart', 'keyboard', 'mouse', 'mouseKeyboard'),
    passwordPromptDetection: Joi.boolean(),
    theme: Joi.string().max(50),
}).unknown(false);

const themeSchema = Joi.object({
    mode: Joi.string().valid('light', 'dark', 'auto', 'oled'),
    accentColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    uiScale: Joi.number().min(0.7).max(1.3),
}).unknown(false);

const filesSchema = Joi.object({
    showThumbnails: Joi.boolean(),
    defaultViewMode: Joi.string().valid('list', 'grid'),
    showHiddenFiles: Joi.boolean(),
    confirmBeforeDelete: Joi.boolean(),
    dragDropAction: Joi.string().valid('ask', 'copy', 'move'),
}).unknown(false);

const remoteDesktopSchema = Joi.object({
    displayScale: Joi.alternatives().try(
        Joi.string().valid('auto'),
        Joi.number().valid(100, 125, 150, 175, 200, 225, 250, 300),
    ),
}).unknown(false);

const generalSchema = Joi.object({
    language: Joi.string().max(10),
    sidebarCollapsed: Joi.boolean(),
}).unknown(false);

module.exports.preferencesValidation = Joi.object({
    terminal: terminalSchema,
    theme: themeSchema,
    files: filesSchema,
    remoteDesktop: remoteDesktopSchema,
    general: generalSchema,
}).unknown(false);
