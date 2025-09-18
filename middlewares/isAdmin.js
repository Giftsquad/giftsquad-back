const Event = require("../models/Event");

const isAdmin = async (req, res, next) => {
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

    // Vérifie si l'utilisateur connecté est bien l’organisateur
    if (!event.event_organizer._id.equals(req.user._id)) {
      return res.status(403).json({
        message:
          "Unauthorized: Seul l'organisateur peut effectuer cette action",
      });
    }

    req.event = event;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = isAdmin;
