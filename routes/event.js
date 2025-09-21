const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const isParticipant = require("../middlewares/isParticipant");
const User = require("../models/User");
const {
  eventAddParticipantValidators,
  eventCreateValidators,
  eventParticipationValidators,
} = require("../validation/Event");
const { matchedData } = require("express-validator");
const { sendInvitationEmail } = require("../services/mailerService");
const { drawParticipants } = require("../services/drawService");
const {
  createFolder,
  destroyFolder,
  EVENT_FOLDER_PATTERN,
} = require("../services/uploadService");

// Création d'un évènement
router.post(
  "/publish",
  isAuthenticated,
  eventCreateValidators,
  async (req, res) => {
    try {
      const { type, name, date, budget = null } = matchedData(req);

      // On crée l'évènement et on ajoute l'utilisateur en tant qu'organisateur et participant
      const newEvent = new Event({
        event_type: type,
        event_name: name,
        event_date: date,
        event_budget: budget,
        event_organizer: req.user,
        event_participants: [
          {
            user: req.user,
            email: req.user.email,
            role: Event.PARTICIPANT_ROLES.organizer,
            status: Event.PARTICIPANT_STATUSES.accepted,
            joinedAt: new Date(),
          },
        ],
      });
      await newEvent.save();

      // Créer le dossier Cloudinary pour cet événement
      try {
        const eventFolder = EVENT_FOLDER_PATTERN.replace(
          "{eventId}",
          newEvent._id
        );
        await createFolder(eventFolder);
        console.log(
          `Dossier Cloudinary créé pour l'événement ${newEvent._id}: ${eventFolder}`
        );
      } catch (folderError) {
        console.error(
          "Erreur lors de la création du dossier Cloudinary:",
          folderError
        );
        // On continue même si la création du dossier échoue
      }

      // Ajout de l'évènement aux évènements de l'utilisateur
      req.user.events.push(newEvent._id);
      await req.user.save();

      res.status(201).json(newEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Liste de tous les évènements de l'utilisateur connecté (seulement ceux acceptés)
router.get("", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find({
      event_participants: {
        $elemMatch: {
          email: req.user.email,
          status: Event.PARTICIPANT_STATUSES.accepted,
        },
      },
    })
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy");
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Liste de toutes les invitations de l'utilisateur connecté
router.get("/invitations", isAuthenticated, async (req, res) => {
  try {
    // On filtre sur tous les évènements pour lequel l'email correspond et le statut est "invité"
    const events = await Event.find({
      event_participants: {
        $elemMatch: {
          email: req.user.email,
          status: Event.PARTICIPANT_STATUSES.invited,
        },
      },
    })
      .populate("event_organizer")
      .populate("event_participants.user");

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lire les informations d'un évènement
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    // On récupère l'évènement complet avec toutes ses références
    const event = await Event.findById(req.params.id)
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.wishList.purchasedBy")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy")
      .populate("event_participants.assignedTo")
      .populate("event_participants.assignedBy");

    if (!event) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Récupération de l'événement complet avec ses cadeaux
router.get("/:id/event", isAuthenticated, isParticipant, async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;

    const event = await Event.findById(eventId)
      .populate("event_participants.user")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy");

    if (!event) {
      return res.status(404).json({ message: "Événement introuvable." });
    }

    // Vérifier si l'utilisateur est un participant de l'événement
    const isUserParticipant = event.event_participants.some(
      (participant) =>
        participant.user && participant.user._id.toString() === userId
    );

    if (!isUserParticipant) {
      return res.status(403).json({
        message: "Accès refusé. Vous n'êtes pas participant de cet événement.",
      });
    }

    // Collecter tous les cadeaux de l'événement
    const allGifts = [];

    // Ajouter les cadeaux de la giftList de l'événement
    if (event.giftList && event.giftList.length > 0) {
      event.giftList.forEach((gift) => {
        allGifts.push({
          ...gift.toObject(),
          source: "giftList",
          eventId: event._id,
          eventName: event.event_name,
          addedByParticipantName: gift.addedBy
            ? gift.addedBy.username
            : "Inconnu",
        });
      });
    }

    // Ajouter les cadeaux des wishLists des participants
    if (event.event_participants && event.event_participants.length > 0) {
      event.event_participants.forEach((participant) => {
        if (participant.wishList && participant.wishList.length > 0) {
          participant.wishList.forEach((gift) => {
            allGifts.push({
              ...gift.toObject(),
              source: "wishList",
              eventId: event._id,
              eventName: event.event_name,
              addedByParticipantName: participant.user
                ? participant.user.username
                : "Inconnu",
            });
          });
        }
      });
    }

    // Retourner l'événement complet avec ses cadeaux
    res.status(200).json({
      event: event,
      gifts: allGifts,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'événement:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Récupération de tous les cadeaux d'un événement
router.get("/:id/gifts", isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est participant de cet événement
    const event = await Event.findOne({
      _id: eventId,
      "event_participants.user": userId,
    })
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy");

    if (!event) {
      return res.status(404).json({ message: "Événement non trouvé." });
    }

    // Collecter tous les cadeaux de l'événement
    const allGifts = [];

    // Ajouter les cadeaux de la giftList
    if (event.giftList && event.giftList.length > 0) {
      event.giftList.forEach((gift) => {
        allGifts.push({
          ...gift.toObject(),
          source: "giftList",
          eventId: event._id,
          eventName: event.event_name,
        });
      });
    }

    // Ajouter les cadeaux des wishList des participants
    if (event.event_participants && event.event_participants.length > 0) {
      event.event_participants.forEach((participant) => {
        if (participant.wishList && participant.wishList.length > 0) {
          participant.wishList.forEach((gift) => {
            allGifts.push({
              ...gift.toObject(),
              source: "wishList",
              participantName: participant.user?.firstname || participant.email,
              eventId: event._id,
              eventName: event.event_name,
            });
          });
        }
      });
    }

    res.status(200).json({
      event: {
        _id: event._id,
        event_name: event.event_name,
        event_type: event.event_type,
      },
      gifts: allGifts,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des cadeaux:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

//Update Event
router.put("/event/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, //$set permet de modifier seulement un champ modifier et pas de remplacer tout l'événement
      { new: true } // retourner la version mise à jour
    );
    if (!updatedEvent)
      return res.status(404).json({ message: "Event not found" });
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ajout d'un participant à un évènement
router.post(
  "/:id/participant",
  isAuthenticated,
  isAdmin,
  eventAddParticipantValidators,
  async (req, res) => {
    try {
      const { email } = matchedData(req);

      const event = req.event;

      // Si l'utilisateur participe déjà à cet évènement, on renvoie une erreur
      const alreadyParticipates = event.event_participants.some(
        (eventParticipant) =>
          eventParticipant.email.toLowerCase() === email.toLowerCase()
      );
      if (alreadyParticipates) {
        return res
          .status(409)
          .json({ message: "L'utilisateur participe déjà à cet évènement." });
      }

      // Vérifier si l'utilisateur existe dans la base de données
      const user = await User.findOne({ email });

      // On ajoute le participant à la liste
      event.event_participants.push({
        user: user ? user : null,
        email,
        role: Event.PARTICIPANT_ROLES.participant,
        status: Event.PARTICIPANT_STATUSES.invited,
        joinedAt: new Date(),
      });

      await event.save();

      // Si l'utilisateur a un compte, on ajoute l'évènement à ses évènements
      if (user) {
        user.events.push(event._id);
        await user.save();
      }

      // On envoie un email pour notifier l'utilisateur
      sendInvitationEmail(event, email, user);

      // Retourner une réponse différente selon si l'utilisateur a un compte ou non
      if (user) {
        res.status(200).json({
          success: true,
          message: "Invitation envoyée avec succès",
          userExists: true,
          event: event,
        });
      } else {
        res.status(200).json({
          success: true,
          message:
            "Invitation envoyée. L'utilisateur devra créer un compte pour accepter l'invitation.",
          userExists: false,
          event: event,
        });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Accept/Decline invitation (accessible sans authentification via email)
router.put("/:id/participant/:action", async (req, res) => {
  try {
    const { id, action } = req.params;
    const { email } = req.query;

    // Le paramètre `action` accepte uniquement "accept" ou "decline"
    if (!["accept", "decline"].includes(action)) {
      return res.status(404).json({ message: "Not found" });
    }

    // Vérifier que l'email est fourni
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    // On récupère l'évènement
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    // Vérifier si l'utilisateur existe dans la base de données
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur non trouvé. Vous devez d'abord créer un compte pour participer à cet événement.",
      });
    }

    // On vérifie s'il existe bien une participation correspondant à son adresse email et avec le statut "invité"
    const participation = event.event_participants.find(
      (eventParticipant) =>
        eventParticipant.email.toLowerCase() === email.toLowerCase() &&
        Event.PARTICIPANT_STATUSES.invited === eventParticipant.status
    );
    if (!participation) {
      return res.status(404).json({ message: "Invitation introuvable" });
    }

    // On lie l'utilisateur à la participation et on met à jour son statut en fonction de l'action récupérée dans l'url
    participation.user = user._id;
    participation.status =
      "accept" === action
        ? Event.PARTICIPANT_STATUSES.accepted
        : Event.PARTICIPANT_STATUSES.declined;

    await event.save();

    // Si l'action est "accept" et l'évènement n'est pas encore lié à l'utilisateur, on ajoute l'évènement à ses évènements
    if (
      "accept" === action &&
      !user.events.find((userEvent) => userEvent._id.equals(event._id))
    ) {
      user.events.push(event._id);
      await user.save();
    }

    // Retourner une réponse JSON simple
    res.status(200).json({
      success: true,
      message:
        action === "accept" ? "Invitation acceptée" : "Invitation déclinée",
      event: {
        name: event.event_name,
        date: event.event_date,
        type: event.event_type,
      },
    });
  } catch (error) {
    // Retourner une réponse JSON d'erreur
    res.status(500).json({
      success: false,
      message:
        "Une erreur s'est produite lors du traitement de votre invitation",
      error: error.message,
    });
  }
});

// Route GET pour gérer les clics sur les liens dans l'email (redirection depuis les boutons)
router.get("/:id/participant/:action", async (req, res) => {
  try {
    const { id, action } = req.params;
    const { email } = req.query;

    // Le paramètre `action` accepte uniquement "accept" ou "decline"
    if (!["accept", "decline"].includes(action)) {
      return res.status(404).json({ message: "Not found" });
    }

    // Vérifier que l'email est fourni
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    // On récupère l'évènement
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    // Vérifier que l'email fait bien partie de la liste des invités
    const isInvited = event.event_participants.some(
      (participant) => participant.email === email
    );

    if (!isInvited) {
      return res.status(403).json({
        message: "Vous n'êtes pas invité à cet événement",
      });
    }

    // Vérifier si l'utilisateur existe dans la base de données
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur non trouvé. Vous devez d'abord créer un compte pour participer à cet événement.",
      });
    }

    // On vérifie s'il existe bien une participation correspondant à son adresse email et avec le statut "invité"
    const participation = event.event_participants.find(
      (eventParticipant) =>
        eventParticipant.email.toLowerCase() === email.toLowerCase() &&
        Event.PARTICIPANT_STATUSES.invited === eventParticipant.status
    );
    if (!participation) {
      return res.status(404).json({ message: "Invitation introuvable" });
    }

    // On lie l'utilisateur à la participation et on met à jour son statut en fonction de l'action récupérée dans l'url
    participation.user = user._id;
    participation.status =
      "accept" === action
        ? Event.PARTICIPANT_STATUSES.accepted
        : Event.PARTICIPANT_STATUSES.declined;

    await event.save();

    // Si l'action est "accept" et l'évènement n'est pas encore lié à l'utilisateur, on ajoute l'évènement à ses évènements
    if (
      "accept" === action &&
      !user.events.find((userEvent) => userEvent._id.equals(event._id))
    ) {
      user.events.push(event._id);
      await user.save();
    }

    // Retourner une réponse JSON simple
    res.status(200).json({
      success: true,
      message:
        action === "accept" ? "Invitation acceptée" : "Invitation déclinée",
      event: {
        name: event.event_name,
        date: event.event_date,
        type: event.event_type,
      },
    });
  } catch (error) {
    // Retourner une réponse JSON d'erreur
    res.status(500).json({
      success: false,
      message:
        "Une erreur s'est produite lors du traitement de votre invitation",
      error: error.message,
    });
  }
});

// Participer pour une Liste d'anniversaire
router.put(
  "/:id/participate",
  isAuthenticated,
  isParticipant,
  eventParticipationValidators,
  async (req, res) => {
    try {
      const { event, participation } = req;
      // Si ce n'est pas une Liste d'anniversaire, il n'y a pas de participation
      if (Event.TYPES.birthday !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste d'anniversaire nécessitent une participation",
        });
      }

      // On met à jour le montant de la participation
      const { amount } = matchedData(req);
      participation.participationAmount = amount;

      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Tirage au sort pour le Secret Santa
router.post("/:id/draw", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const event = req.event;
    // Si ce n'est pas un Secret Santa, il n'y a pas de tirage au sort
    if (Event.TYPES.secret_santa !== event.event_type) {
      return res.status(400).json({
        message:
          "Seuls les évènements Secret Santa nécessitent un tirage au sort",
      });
    }

    // S'il n'y a que 2 participants il n'y a pas besoin de tirage
    if (2 > event.event_participants.length) {
      return res.status(400).json({
        message: "Il faut au moins 2 participants pour faire un tirage",
      });
    }

    // Si le tirage a déjà été effectué, on renvoie une erreur
    if (event.drawnAt) {
      return res.status(400).json({
        message: "Le tirage a déjà été effectué pour cet évènement",
      });
    }

    // On effectue le tirage au sort uniquement sur les participants qui ont accepté
    drawParticipants(
      event.event_participants.filter(
        (eventParticipant) =>
          Event.PARTICIPANT_STATUSES.accepted === eventParticipant.status
      )
    );
    event.drawnAt = new Date();

    await event.save();

    return res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Supprimer un évènement
router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Récupérer l'événement avant de le supprimer pour avoir la liste des participants
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    // Supprimer l'ID de l'événement de tous les profils utilisateurs concernés
    const participantIds = event.event_participants
      .filter((participant) => participant.user)
      .map((participant) => participant.user);

    if (participantIds.length > 0) {
      await User.updateMany(
        { _id: { $in: participantIds } },
        { $pull: { events: eventId } }
      );
    }

    // On supprime l'évènement
    const deletedEvent = await Event.findByIdAndDelete(eventId);

    // On supprime également le dossier de l'évènement
    try {
      const eventFolder = EVENT_FOLDER_PATTERN.replace(
        "{eventId}",
        deletedEvent._id
      );
      await destroyFolder(eventFolder);
    } catch (folderError) {
      console.error(
        "Erreur lors de la suppression du dossier Cloudinary:",
        folderError
      );
      // On continue même si la suppression du dossier échoue
    }

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route DELETE pour retirer un participant (seulement pour l'organisateur)
router.delete(
  "/:id/participant/:email",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { email } = req.params;
      const event = req.event; // L'événement est déjà récupéré par isAdmin

      // Vérifier que le participant à retirer existe
      const participantIndex = event.event_participants.findIndex(
        (participant) => participant.email === email
      );

      if (participantIndex === -1) {
        return res.status(404).json({
          message: "Participant introuvable dans cet événement",
        });
      }

      // Ne pas permettre de retirer l'organisateur lui-même
      if (event.event_participants[participantIndex].role === "organizer") {
        return res.status(400).json({
          message: "L'organisateur ne peut pas se retirer de l'événement",
        });
      }

      const participant = event.event_participants[participantIndex];

      // Retirer le participant
      event.event_participants.splice(participantIndex, 1);
      await event.save();

      // Supprimer l'ID de l'événement du profil utilisateur
      if (participant.user) {
        await User.findByIdAndUpdate(participant.user, {
          $pull: { events: req.params.id },
        });
      }

      res.json({
        success: true,
        message: "Participant retiré avec succès",
        event: {
          _id: event._id,
          event_name: event.event_name,
          event_type: event.event_type,
          event_participants: event.event_participants,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la suppression du participant:", error);
      res.status(500).json({
        success: false,
        message:
          "Une erreur s'est produite lors de la suppression du participant",
        error: error.message,
      });
    }
  }
);

// Ajout des routes concernants les cadeaux et souhaits
const giftRoutes = require("./gift");
router.use(giftRoutes);

module.exports = router;
