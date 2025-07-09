const joiToOpenApiSchema = (joiSchema, name = "") => {
    if (!joiSchema?.describe || typeof joiSchema.describe !== "function") return { type: "object" };

    const description = joiSchema.describe();
    if (description.type !== "object" || !description.keys) return { type: "object" };

    const schema = { type: "object", properties: {}, ...(name && { description: `${name} request schema` }) };

    const required = [];

    for (const [key, field] of Object.entries(description.keys)) {
        schema.properties[key] = convertJoiFieldToOpenApi(field, key);

        if (isFieldRequired(field)) required.push(key);
    }

    if (required.length > 0) schema.required = required;

    return schema;
};

const ruleProcessors = {
    string: {
        min: (property, rule) => property.minLength = rule.args.limit,
        max: (property, rule) => property.maxLength = rule.args.limit,
        alphanum: (property) => {
            property.pattern = "^[a-zA-Z0-9]+$";
            property._alphanum = true;
        },
    },
    number: {
        integer: (property) => property.type = "integer",
        min: (property, rule) => property.minimum = rule.args.limit,
        max: (property, rule) => property.maximum = rule.args.limit,
    },
};

const convertJoiFieldToOpenApi = (joiField, fieldName) => {
    const property = { type: getPropertyType(joiField.type) };

    if (joiField.flags?.default !== undefined) {
        property.default = joiField.flags.default;
    }

    if (joiField.rules && ruleProcessors[joiField.type]) {
        const processor = ruleProcessors[joiField.type];
        joiField.rules.forEach(rule => {
            processor[rule.name]?.(property, rule);
        });
    }

    if (joiField.allow && Array.isArray(joiField.allow)) {
        const validValues = joiField.allow.filter(v => v !== null && v !== undefined && v !== "");
        if (validValues.length > 0) {
            property.enum = validValues;
        }
        if (joiField.allow.includes(null)) {
            property.nullable = true;
        }
    }

    if (joiField.type === "array" && joiField.items?.[0]) {
        property.items = convertJoiFieldToOpenApi(joiField.items[0], `${fieldName}Item`);
    } else if (joiField.type === "object" && joiField.keys) {
        property.properties = Object.fromEntries(Object.entries(joiField.keys).map(([key, value]) => [key, convertJoiFieldToOpenApi(value, key)]));
    }

    property.description = generateFieldDescription(fieldName, property);

    return property;
};

const getPropertyType = (joiType) => {
    const typeMap = {
        string: "string",
        number: "number",
        boolean: "boolean",
        array: "array",
        object: "object",
    };
    return typeMap[joiType] || "string";
};

const isFieldRequired = (joiField) => joiField.flags?.presence === "required";

const generateFieldDescription = (fieldName, property) => {
    let description = fieldName.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, char => char.toUpperCase());

    const constraints = buildConstraintsList(property);
    delete property._alphanum;

    if (property.default !== undefined) {
        const defaultValueText = `default: ${JSON.stringify(property.default)}`;
        constraints.push(defaultValueText);
    }

    return constraints.length > 0 ? `${description} (${constraints.join(", ")})` : description;
};

const buildConstraintsList = (property) => {
    const constraints = [];

    if (property.minLength && property.maxLength) {
        constraints.push(`${property.minLength}-${property.maxLength} characters`);
    } else if (property.minLength) {
        constraints.push(`minimum ${property.minLength} characters`);
    } else if (property.maxLength) {
        constraints.push(`maximum ${property.maxLength} characters`);
    }

    if (property.minimum !== undefined && property.maximum !== undefined) {
        constraints.push(`between ${property.minimum} and ${property.maximum}`);
    } else if (property.minimum !== undefined) {
        constraints.push(`minimum value ${property.minimum}`);
    } else if (property.maximum !== undefined) {
        constraints.push(`maximum value ${property.maximum}`);
    }

    if (property.enum?.length > 0) {
        constraints.push(`allowed values: ${property.enum.join(", ")}`);
    }

    if (property.pattern === "^[a-zA-Z0-9]+$" || property._alphanum) {
        constraints.push("alphanumeric characters only");
    }

    return constraints;
};

const extractSchemasFromValidation = (validationModule) => {
    return Object.fromEntries(
        Object.entries(validationModule)
            .filter(([, value]) => value?.describe && typeof value.describe === "function")
            .map(([key, value]) => {
                const schemaName = key.charAt(0).toUpperCase() + key.slice(1).replace(/Validation$/, "");
                return [schemaName, joiToOpenApiSchema(value, schemaName)];
            }),
    );
};

module.exports = { joiToOpenApiSchema, extractSchemasFromValidation };