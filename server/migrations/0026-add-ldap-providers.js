module.exports = {
    async up(queryInterface, DataTypes) {
        await queryInterface.createTable('ldap_providers', {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                allowNull: false,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            host: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            port: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 389,
            },
            bindDN: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            bindPassword: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            bindPasswordIV: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            bindPasswordAuthTag: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            baseDN: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            userSearchFilter: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '(uid={{username}})',
            },
            usernameAttribute: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'uid',
            },
            firstNameAttribute: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: 'givenName',
            },
            lastNameAttribute: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: 'sn',
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            useTLS: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        });

        await queryInterface.removeColumn('oidc_providers', 'emailAttribute');
    }
};
