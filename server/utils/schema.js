module.exports.validateSchema = (res, schema, object) => {
    const { error } = schema.validate(object, { errors: { wrap: { label: "" } } });
    const message = error?.details[0].message || "No message provided";

    if (error) res.status(400).json({ message });

    return error;
};
