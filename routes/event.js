const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const User = require("../models/User");
const {
  eventAddParticipantValidators,
  eventCreateValidators,
} = require("../validation/Event");
const { matchedData } = require("express-validator");
const { sendInvitationEmail } = require("../services/mailerService");
const { drawParticipants } = require("../services/drawService");
const {
  destroyFolder,
  GIFT_LIST_FOLDER_PATTERN,
} = require("../services/uploadService");

// Create event
router.post(
  "/publish",
  isAuthenticated,
  eventCreateValidators,
  async (req, res) => {
    try {
      const { type, name, date, budget = null } = matchedData(req);

      const newEvent = new Event({
        event_type: type,
        event_name: name,
        event_date: date,
        event_budget: budget,
        event_organizer: req.user,
        event_participants: [
          {
            participant: {
              user: req.user,
              email: req.user.email,
            },
            role: Event.PARTICIPANT_ROLES.organizer,
            status: Event.PARTICIPANT_STATUSES.accepted,
            joinedAt: new Date(),
          },
        ],
      });
      await newEvent.save();

      // Ajout de l'event aux events de l'utilisateur
      req.user.events.push(newEvent._id);
      await req.user.save();

      res.status(201).json(newEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Read All Events for authenticated user
router.get("", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find({
      "event_participants.participant.email": req.user.email,
    });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Read All Invitations for authenticated user
router.get("/invitations", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find({
      event_participants: {
        $elemMatch: {
          "participant.email": req.user.email,
          status: Event.PARTICIPANT_STATUSES.invited,
        },
      },
    });

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Read specific Event
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("event_organizer")
      .populate("event_participants.participant.user")
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

// Add participant
router.put(
  "/:id/add-participant",
  isAuthenticated,
  isAdmin,
  eventAddParticipantValidators,
  async (req, res) => {
    try {
      const { email } = matchedData(req);

      const event = req.event;

      const alreadyParticipates = event.event_participants.some(
        (eventParticipant) =>
          eventParticipant.participant.email.toLowerCase() ===
          email.toLowerCase()
      );

      if (alreadyParticipates) {
        return res
          .status(409)
          .json({ message: "L'utilisateur participe déjà à cet évènement." });
      }

      const user = await User.findOne({ email });
      event.event_participants.push({
        participant: {
          user: user ? user : null,
          email,
        },
        role: Event.PARTICIPANT_ROLES.participant,
        status: Event.PARTICIPANT_STATUSES.invited,
        joinedAt: new Date(),
      });

      await event.save();

      // Ajout de l'event aux events de l'utilisateur
      if (user) {
        user.events.push(event._id);
        await user.save();
      }

      sendInvitationEmail(event, email, user);

      return res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Accept/Decline invitation
router.put("/:id/:action-invitation", isAuthenticated, async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!["accept", "decline"].includes(action)) {
      return res.status(404).json({ message: "Not found" });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    const participation = event.event_participants.find(
      (eventParticipant) =>
        eventParticipant.participant.email.toLowerCase() ===
          req.user.email.toLowerCase() &&
        Event.PARTICIPANT_STATUSES.invited === eventParticipant.status
    );
    if (!participation) {
      return res.status(404).json({ message: "Invitation introuvable" });
    }

    participation.participant.user = req.user._id;
    participation.status =
      "accept" === action
        ? Event.PARTICIPANT_STATUSES.accepted
        : Event.PARTICIPANT_STATUSES.declined;

    await event.save();

    return res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Draw for Secret Santa
router.put("/:id/draw", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const event = req.event;
    if (Event.TYPES.secret_santa !== event.event_type) {
      return res.status(400).json({
        message:
          "Seuls les évènements Secret Santa nécessitent un tirage au sort",
      });
    }

    if (2 > event.event_participants.length) {
      return res.status(400).json({
        message: "Il faut au moins 2 participants pour faire un tirage",
      });
    }

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

//Delete Event
router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);

    destroyFolder(
      GIFT_LIST_FOLDER_PATTERN.replace("{eventId}", deletedEvent._id)
    );
    if (!deletedEvent)
      return res.status(404).json({ message: "Event not found" });
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const giftRoutes = require("./gift");
router.use(giftRoutes);

module.exports = router;
