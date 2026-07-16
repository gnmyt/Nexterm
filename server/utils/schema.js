module.exports.validateSchema = (res, schema, object) => {
    const { error, value } = schema.validate(object, { errors: { wrap: { label: "" } }, allowUnknown: false });

    if (error) {
        res.status(400).json({ message: error.details[0].message || "No message provided" });
        return error;
    }

    if (object !== null && typeof object === "object") Object.assign(object, value);

    return error;
};
