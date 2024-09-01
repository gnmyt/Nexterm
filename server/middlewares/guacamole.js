const { authorizeGuacamole } = require("./auth");
const guacamoleProxy = require("../controllers/guacamoleProxy");

module.exports = async (req, res) => {
    const token = await authorizeGuacamole(req);
    if (!token) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    guacamoleProxy(req.ws, token);
};