const guacamoleProxy = require("../controllers/guacamoleProxy");

module.exports = async (ws, context) => {
    const { connectionConfig } = context;
    
    guacamoleProxy(ws, connectionConfig);
};
