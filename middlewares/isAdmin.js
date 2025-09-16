const Event = require("../models/Event");

const isAdmin = async (req, res, next) => {
  try {
    //rechercher l'événement à modifier
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifie si l'utilisateur connecté est bien l’organisateur
    if (event.event_organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Unauthorized: only organizer can perform this action",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = isAdmin;
