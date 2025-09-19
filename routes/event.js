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
  destroyFolder,
  GIFT_LIST_FOLDER_PATTERN,
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

      // Ajout de l'évènement aux évènements de l'utilisateur
      req.user.events.push(newEvent._id);
      await req.user.save();

      res.status(201).json(newEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Liste de tous les évènements de l'utilisateur connecté
router.get("", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find({
      "event_participants.email": req.user.email,
    });
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

      // On ajoute le participant à la liste
      // Si l'utilisateur a un compte, on le lie à l'évènement
      const user = await User.findOne({ email });
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

      res.status(200).json(event);
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
    // On supprime l'évènement
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);

    // On supprime également les photos de l'évènement
    destroyFolder(
      GIFT_LIST_FOLDER_PATTERN.replace("{eventId}", deletedEvent._id)
    );

    // Si l'évènement est introuvable on renvoie une erreur
    if (!deletedEvent) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ajout des routes concernants les cadeaux et souhaits
const giftRoutes = require("./gift");
router.use(giftRoutes);

module.exports = router;
