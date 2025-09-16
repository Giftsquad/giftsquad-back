const User = require("../models/User");
const uid2 = require("uid2");

const isAuthenticated = async (req, res, next) => {
  try {
    // Vérifier si le header Authorization est présent
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Extraire le token du header "Bearer <token>"
    const token = req.headers.authorization.replace("Bearer ", "");

    // Chercher l'utilisateur avec ce token
    let user = await User.findOne({ token: token });

    if (!user) {
      // Si aucun utilisateur trouvé avec ce token, essayer de trouver par email
      // (dans le cas où le token a expiré côté serveur mais l'utilisateur existe encore)
      const emailFromToken = req.body?.email || req.query?.email;

      if (emailFromToken) {
        user = await User.findOne({ email: emailFromToken });

        if (user) {
          // Régénérer un nouveau token pour cet utilisateur
          const newToken = uid2(64);
          user.token = newToken;
          await user.save();

          // Ajouter le nouveau token dans la réponse pour que le frontend puisse le mettre à jour
          res.set("X-New-Token", newToken);
        }
      }

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    // Ajouter l'utilisateur à l'objet request pour l'utiliser dans les routes
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = isAuthenticated;
