module.exports = {
    async up(queryInterface, Sequelize) {
        const { STRING, DATE, INTEGER } = Sequelize;

        await queryInterface.createTable("engines", {
            id: {
                type: INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: STRING,
                allowNull: false,
            },
            registrationToken: {
                type: STRING,
                allowNull: false,
                unique: true,
            },
            lastConnectedAt: {
                type: DATE,
                allowNull: true,
            },
            isLocal: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            createdAt: {
                type: DATE,
                allowNull: false,
            },
            updatedAt: {
                type: DATE,
                allowNull: false,
            },
        });
    },
};
