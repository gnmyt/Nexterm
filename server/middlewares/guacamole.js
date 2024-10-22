const { authorizeGuacamole } = require("./auth");
const guacamoleProxy = require("../controllers/guacamoleProxy");

module.exports = async (req, res) => {
    const settings = await authorizeGuacamole(req);
    if (!settings) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    guacamoleProxy(req.ws, settings);
};