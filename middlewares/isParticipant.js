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

    // Vérifie si l'utilisateur connecté est bien un participant (organisateur ou participant accepté)
    const isOrganizer =
      event.event_organizer && event.event_organizer._id.equals(req.user._id);

    const participation = event.event_participants.find(
      (eventParticipant) =>
        eventParticipant.user &&
        eventParticipant.user._id.equals(req.user._id) &&
        Event.PARTICIPANT_STATUSES.accepted === eventParticipant.status
    );

    // L'utilisateur doit être soit l'organisateur, soit un participant accepté
    if (!isOrganizer && !participation) {
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
