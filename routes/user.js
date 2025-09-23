const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const express = require("express");
const User = require("../models/User");
const Event = require("../models/Event");
const {
  userLoginValidators,
  userSignupValidators,
  userUpdateValidators,
} = require("../validation/User");
const { matchedData } = require("express-validator");
const isAuthenticated = require("../middlewares/isAuthenticated");
const router = express.Router();

// Fonction pour lier automatiquement les événements aux nouveaux utilisateurs
const linkUserToPendingEvents = async (user) => {
  try {
    // Vérifier que l'utilisateur a bien un _id
    if (!user || !user._id) {
      console.error("Utilisateur invalide pour la liaison automatique");
      return 0;
    }

    // Chercher tous les événements où l'utilisateur est invité mais n'a pas encore de compte
    const eventsWithPendingInvitations = await Event.find({
      event_participants: {
        $elemMatch: {
          email: user.email,
          status: Event.PARTICIPANT_STATUSES.invited,
          user: null, // Pas encore lié à un utilisateur
        },
      },
    });

    if (eventsWithPendingInvitations.length > 0) {
      // Ajouter l'utilisateur à la liste des événements
      user.events.push(
        ...eventsWithPendingInvitations.map((event) => event._id)
      );

      // Mettre à jour les participants dans chaque événement
      for (const event of eventsWithPendingInvitations) {
        const participant = event.event_participants.find(
          (p) =>
            p.email === user.email &&
            p.status === Event.PARTICIPANT_STATUSES.invited
        );

        if (participant) {
          participant.user = user._id;
        }

        await event.save();
      }

      await user.save();

      console.log(
        `Utilisateur ${user.email} lié à ${eventsWithPendingInvitations.length} événement(s) en attente`
      );
    }

    return eventsWithPendingInvitations.length;
  } catch (error) {
    console.error(
      "Erreur lors de la liaison automatique des événements:",
      error
    );
    throw error;
  }
};

// SIGNUP
router.post("/signup", userSignupValidators, async (req, res) => {
  try {
    const { email, firstname, lastname, nickname, password } = matchedData(req);

    const existingByEmail = await User.findOne({ email });
    if (existingByEmail) {
      return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const existingByNickname = await User.findOne({ nickname });
    if (existingByNickname) {
      return res.status(409).json({ message: "Ce pseudo est déjà utilisé" });
    }

    const salt = uid2(64);
    const hash = SHA256(password + salt).toString(encBase64);
    const token = uid2(64);

    const newUser = new User({
      email,
      firstname,
      lastname,
      nickname,
      token,
      hash,
      salt,
    });
    await newUser.save();

    // Lier automatiquement l'utilisateur aux événements en attente
    try {
      const linkedEventsCount = await linkUserToPendingEvents(newUser);
      console.log(
        `Nouvel utilisateur ${email} lié à ${linkedEventsCount} événement(s) en attente`
      );
    } catch (error) {
      console.error(
        "Erreur lors de la liaison automatique des événements:",
        error
      );
      // Ne pas faire échouer l'inscription si la liaison échoue
    }

    return res.status(201).json(getShowableUser(newUser));
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// LOGIN
router.post("/login", userLoginValidators, async (req, res) => {
  try {
    const { email, password } = matchedData(req);

    // Login normal avec email et password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const newHash = SHA256(password + user.salt).toString(encBase64);
    if (newHash !== user.hash) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json(getShowableUser(user));
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// VALIDATE TOKEN
router.post("/validate", isAuthenticated, async (req, res) => {
  try {
    return res.status(200).json(getShowableUser(req.user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// GET USER WITH POPULATED EVENTS
router.get("/me/events", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "events",
      populate: [
        {
          path: "event_organizer",
          select: "firstname lastname nickname email",
        },
        {
          path: "event_participants.user",
          select: "firstname lastname nickname email",
        },
        {
          path: "event_participants.wishList.addedBy",
          select: "firstname lastname nickname email",
        },
        {
          path: "event_participants.wishList.purchasedBy",
          select: "firstname lastname nickname email",
        },
        {
          path: "giftList.addedBy",
          select: "firstname lastname nickname email",
        },
        {
          path: "giftList.purchasedBy",
          select: "firstname lastname nickname email",
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    return res.status(200).json(getShowableUserWithEvents(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// GET USER BY ID
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    return res.status(200).json(getShowableUser(user));
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// UPDATE
router.put(
  "/update",
  isAuthenticated,
  userUpdateValidators,
  async (req, res) => {
    try {
      const { email, firstname, lastname, nickname } = matchedData(req);

      const existingByEmail = await User.findOne({ email });
      if (existingByEmail && !existingByEmail._id.equals(req.user._id)) {
        return res.status(409).json({ message: "Cet email est déjà utilisé" });
      }

      const existingByNickname = await User.findOne({ nickname });
      if (existingByNickname && !existingByNickname._id.equals(req.user._id)) {
        return res.status(409).json({ message: "Ce pseudo est déjà utilisé" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { email, firstname, lastname, nickname },
        {
          new: true,
        }
      );
      return res.status(200).json(getShowableUser(updatedUser));
    } catch (error) {
      return res.status(500).json({ message: error });
    }
  }
);

module.exports = router;

const getShowableUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    token: user.token,
    firstname: user.firstname,
    lastname: user.lastname,
    nickname: user.nickname,
    email: user.email,
    events: user.events || [],
  };
};

const getShowableUserWithEvents = (user) => {
  if (!user) {
    return null;
  }

  // Filtrer les événements pour ne garder que ceux où l'utilisateur a le statut 'accepted'
  const acceptedEvents = (user.events || []).filter((event) => {
    // Vérifier si l'utilisateur est l'organisateur (toujours accepté)
    const isOrganizer = event.event_participants?.some(
      (participant) =>
        participant.user?._id?.toString() === user._id.toString() &&
        participant.role === "organizer"
    );

    if (isOrganizer) {
      return true;
    }

    // Vérifier si l'utilisateur est un participant avec le statut 'accepted'
    const isAcceptedParticipant = event.event_participants?.some(
      (participant) =>
        participant.user?._id?.toString() === user._id.toString() &&
        participant.status === "accepted"
    );

    return isAcceptedParticipant;
  });

  return {
    _id: user._id,
    token: user.token,
    firstname: user.firstname,
    lastname: user.lastname,
    nickname: user.nickname,
    email: user.email,
    events: acceptedEvents,
  };
};
