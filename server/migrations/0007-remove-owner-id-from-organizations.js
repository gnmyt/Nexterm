module.exports = {
    async up(queryInterface) {
        const tableDescription = await queryInterface.describeTable("organizations");

        if (tableDescription.ownerId) {
            await queryInterface.removeColumn("organizations", "ownerId");
        }
    },
};
