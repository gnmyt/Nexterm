#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const express = require("express");
const { generateOpenAPISpec } = require("../server/openapi");

const main = async () => {
    try {
        console.log("Generating OpenAPI specification...");

        const openApiSpec = await generateOpenAPISpec(express());

        const outputPath = path.join(__dirname, "..", "docs", "public", "openapi.json");
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));

        console.log("OpenAPI specification generated successfully!");
        console.log(`Saved to: ${outputPath}`);
        console.log(`Generated ${Object.keys(openApiSpec.paths || {}).length} API endpoints`);
        console.log(`Generated ${Object.keys(openApiSpec.components?.schemas || {}).length} schemas`);

        process.exit(0);
    } catch (error) {
        console.error("Error generating OpenAPI specification:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

main();
