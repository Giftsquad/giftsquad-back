const Event = require("../models/Event");

const isParticipant = async (req, res, next) => {
  try {
    // Rechercher l'événement à modifier
    const event = await Event.findById(req.params.id)
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.assignedTo")
      .populate("event_participants.assignedBy");

    if (!event) {
      return res.status(404).json({ message: "Evènement introuvable" });
    }

    // Vérifie si l'utilisateur connecté est bien un participant
    if (!event.event_organizer._id.equals(req.user._id)) {
      return res.status(403).json({
        message: "Forbidden: Seul l'organisateur peut effectuer cette action",
      });
    }

    const participation = event.event_participants.find(
      (eventParticipant) =>
        eventParticipant.email.toLowerCase() === req.user.email.toLowerCase() &&
        Event.PARTICIPANT_STATUSES.accepted === eventParticipant.status
    );
    if (!participation) {
      return res
        .status(403)
        .json({ message: "Forbidden: Ne participe pas à l'évènement" });
    }

    req.event = event;
    req.participation = participation;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = isParticipant;
