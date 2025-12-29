const ICON_MAP = {
    server: "mdiServerOutline", windows: "mdiMicrosoftWindows", linux: "mdiLinux",
    debian: "mdiDebian", ubuntu: "mdiUbuntu", fedora: "mdiFedora", arch: "mdiLinux",
    freebsd: "mdiFreebsd", macos: "mdiApple", docker: "mdiDocker", kubernetes: "mdiKubernetes",
    database: "mdiDatabase", cloud: "mdiCloud", raspberry: "mdiRaspberryPi",
    terminal: "mdiConsole", desktop: "mdiMonitor", vm: "mdiCube",
};

module.exports = {
    async up(queryInterface) {
        const entries = await queryInterface.sequelize.query(
            "SELECT id, icon FROM entries WHERE icon IS NOT NULL AND icon NOT LIKE 'mdi%'",
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        for (const { id, icon } of entries) {
            if (ICON_MAP[icon]) {
                await queryInterface.sequelize.query(
                    "UPDATE entries SET icon = ? WHERE id = ?",
                    { replacements: [ICON_MAP[icon], id] }
                );
            }
        }
    },
};
