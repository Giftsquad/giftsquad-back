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
              name: `${req.user.firstname} ${req.user.lastname}`,
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

//Read All Event
router.get("/event", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find().populate("event_organizer");
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Read specific Event
router.get("/event/:id", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "event_organizer"
    );
    if (!event) return res.status(404).json({ message: "Event not found" });
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
    const { email } = matchedData(req);

    const event = req.event;

    const alreadyParticipates = event.event_participants.some(
      (eventParticipant) =>
        eventParticipant.participant.email.toLowerCase() === email.toLowerCase()
    );

    if (alreadyParticipates) {
      return res
        .status(409)
        .json({ message: "L'utilisateur participe déjà à cet évènement." });
    }

    const user = await User.findOne({ email });
    event.event_participants.push({
      participant: {
        name: user ? `${user.firstname} ${user.lastname}` : null,
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
  }
);

// Accept/Decline invitation
router.put("/:id/:action-invitation", isAuthenticated, async (req, res) => {
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

  participation.participant.name = `${req.user.firstname} ${req.user.lastname}`;
  participation.status =
    "accept" === action
      ? Event.PARTICIPANT_STATUSES.accepted
      : Event.PARTICIPANT_STATUSES.declined;

  await event.save();

  return res.status(200).json(event);
});

//Delete Event
router.delete("/event/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);
    if (!deletedEvent)
      return res.status(404).json({ message: "Event not found" });
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
