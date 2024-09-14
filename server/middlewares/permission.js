module.exports.isAdmin = async (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ code: 403, message: "Forbidden" });
    }

    next();
}