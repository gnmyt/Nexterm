const Joi = require('joi');

module.exports.updateMonitoringSettingsValidation = Joi.object({
    statusCheckerEnabled: Joi.boolean(),
    statusInterval: Joi.number().integer().min(10).max(300),
    monitoringEnabled: Joi.boolean(),
    monitoringInterval: Joi.number().integer().min(30).max(600),
    dataRetentionHours: Joi.number().integer().min(1).max(24),
    connectionTimeout: Joi.number().integer().min(5).max(120),
    batchSize: Joi.number().integer().min(1).max(50),
});
