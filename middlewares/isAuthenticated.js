const User = require("../models/User");

const isAuthenticated = async (req, res, next) => {
  try {
    // Vérifier si le header Authorization est présent
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Extraire le token du header "Bearer <token>"
    const token = req.headers.authorization.replace("Bearer ", "");

    // Chercher l'utilisateur avec ce token
    const user = await User.findOne({ token: token });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Ajouter l'utilisateur à l'objet request pour l'utiliser dans les routes
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = isAuthenticated;
