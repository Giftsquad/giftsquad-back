const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const isAuthenticated = require("../middlewares/isAuthenticated");

// GET /event - Récupérer tous les événements de l'utilisateur
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const events = await Event.find({
      $or: [{ organizer: req.user._id }, { "participants.user": req.user._id }],
    })
      .populate("organizer", "firstname lastname nickname")
      .populate("participants.user", "firstname lastname nickname")
      .populate("participants.assignedTo", "firstname lastname nickname")
      .populate("participants.assignedBy", "firstname lastname nickname")
      .populate(
        "participants.wishlist.purchasedBy",
        "firstname lastname nickname"
      )
      .populate("participants.gift.receiver", "firstname lastname nickname")
      .populate("participants.gift.giver", "firstname lastname nickname")
      .sort({ createdAt: -1 });

    return res.status(200).json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// GET /event/:id - Récupérer un événement spécifique
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("organizer", "firstname lastname nickname")
      .populate("participants.user", "firstname lastname nickname")
      .populate("participants.assignedTo", "firstname lastname nickname")
      .populate("participants.assignedBy", "firstname lastname nickname")
      .populate(
        "participants.wishlist.purchasedBy",
        "firstname lastname nickname"
      )
      .populate("participants.gift.receiver", "firstname lastname nickname")
      .populate("participants.gift.giver", "firstname lastname nickname");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifier si l'utilisateur a accès à cet événement
    const hasAccess =
      event.organizer._id.toString() === req.user._id.toString() ||
      event.participants.some(
        (p) => p.user._id.toString() === req.user._id.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// POST /event - Créer un nouvel événement
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const User = require("../models/User");
    const { name, type, description, date, budget, rules } = req.body;

    if (!name || !type || !date) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const newEvent = new Event({
      name,
      type,
      description,
      organizer: req.user._id,
      date: new Date(date),
      budget: budget || 0,
      participants: [
        {
          user: req.user._id,
          role: "organizer",
          status: "accepted",
        },
      ],
    });

    await newEvent.save();

    // Ajouter l'événement à la liste des événements de l'organisateur
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { events: newEvent._id },
    });

    // Populate complet de l'événement
    await newEvent.populate([
      { path: "organizer", select: "firstname lastname nickname" },
      { path: "participants.user", select: "firstname lastname nickname" },
      {
        path: "participants.wishlist.purchasedBy",
        select: "firstname lastname nickname",
      },
    ]);

    return res.status(201).json(newEvent);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// PUT /event/:id - Modifier un événement
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifier si l'utilisateur est l'organisateur
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only organizer can modify event" });
    }

    const { name, type, description, date, budget, rules, status } = req.body;

    if (name) event.name = name;
    if (type) event.type = type;
    if (description !== undefined) event.description = description;
    if (date) event.date = new Date(date);
    if (budget !== undefined) event.budget = budget;
    if (rules !== undefined) event.rules = rules;
    if (status) event.status = status;

    await event.save();

    // Populate complet de l'événement
    await event.populate([
      { path: "organizer", select: "firstname lastname nickname" },
      { path: "participants.user", select: "firstname lastname nickname" },
      {
        path: "participants.wishlist.purchasedBy",
        select: "firstname lastname nickname",
      },
    ]);

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /event/:id - Supprimer un événement
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifier si l'utilisateur est l'organisateur
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only organizer can delete event" });
    }

    await Event.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// POST /event/:id/join - Rejoindre un événement
router.post("/:id/join", isAuthenticated, async (req, res) => {
  try {
    const Event = require("../models/Event");
    const User = require("../models/User");

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifier si l'utilisateur est déjà dans l'événement
    const existingParticipant = event.participants.find(
      (p) => p.user.toString() === req.user._id.toString()
    );
    if (existingParticipant) {
      return res.status(400).json({ message: "User already in event" });
    }

    // Ajouter l'utilisateur à l'événement
    event.participants.push({
      user: req.user._id,
      role: "participant",
      status: "accepted",
    });

    // Ajouter l'événement à la liste des événements de l'utilisateur
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { events: event._id },
    });

    await event.save();

    // Populate complet de l'événement
    await event.populate([
      { path: "organizer", select: "firstname lastname nickname" },
      { path: "participants.user", select: "firstname lastname nickname" },
      {
        path: "participants.wishlist.purchasedBy",
        select: "firstname lastname nickname",
      },
    ]);

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// POST /event/:id/leave - Quitter un événement
router.post("/:id/leave", isAuthenticated, async (req, res) => {
  try {
    const User = require("../models/User");

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifier si l'utilisateur est l'organisateur
    if (event.organizer.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Organizer cannot leave event" });
    }

    // Retirer l'utilisateur de l'événement
    event.participants = event.participants.filter(
      (p) => p.user.toString() !== req.user._id.toString()
    );

    // Retirer l'événement de la liste des événements de l'utilisateur
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { events: event._id },
    });

    await event.save();

    return res.status(200).json({ message: "Left event successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// POST /event/:id/assign - Faire les assignations Secret Santa
router.post("/:id/assign", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Vérifier si l'utilisateur est l'organisateur
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only organizer can assign" });
    }

    // Vérifier si c'est un Secret Santa
    if (event.type !== "secret_santa") {
      return res
        .status(400)
        .json({ message: "Assignments only for Secret Santa" });
    }

    const participants = event.participants.filter(
      (p) => p.status === "accepted" && p.role === "participant"
    );

    if (participants.length < 2) {
      return res.status(400).json({ message: "Need at least 2 participants" });
    }

    // Mélanger les participants
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // Faire les assignations
    for (let i = 0; i < shuffled.length; i++) {
      const currentUser = shuffled[i];
      const nextUser = shuffled[(i + 1) % shuffled.length];

      currentUser.assignedTo = nextUser.user;
      nextUser.assignedBy = currentUser.user;
    }

    await event.save();

    // Populate complet de l'événement
    await event.populate([
      { path: "organizer", select: "firstname lastname nickname" },
      { path: "participants.user", select: "firstname lastname nickname" },
      {
        path: "participants.assignedTo",
        select: "firstname lastname nickname",
      },
      {
        path: "participants.assignedBy",
        select: "firstname lastname nickname",
      },
      {
        path: "participants.wishlist.purchasedBy",
        select: "firstname lastname nickname",
      },
    ]);

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// PUT /event/:id/wishlist - Modifier la wishlist d'un utilisateur
router.put("/:id/wishlist", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Trouver l'utilisateur dans l'événement
    const participantInEvent = event.participants.find(
      (p) => p.user.toString() === req.user._id.toString()
    );
    if (!participantInEvent) {
      return res.status(403).json({ message: "User not in event" });
    }

    const { wishlist } = req.body;
    if (wishlist) {
      participantInEvent.wishlist = wishlist;
    }

    await event.save();

    // Populate complet de l'événement
    await event.populate([
      { path: "organizer", select: "firstname lastname nickname" },
      { path: "participants.user", select: "firstname lastname nickname" },
      {
        path: "participants.wishlist.purchasedBy",
        select: "firstname lastname nickname",
      },
    ]);

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// PUT /event/:id/gift - Modifier le cadeau d'un utilisateur
router.put("/:id/gift", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Trouver l'utilisateur dans l'événement
    const participantInEvent = event.participants.find(
      (p) => p.user.toString() === req.user._id.toString()
    );
    if (!participantInEvent) {
      return res.status(403).json({ message: "User not in event" });
    }

    const { gift } = req.body;
    if (gift) {
      participantInEvent.gift = { ...participantInEvent.gift, ...gift };
    }

    await event.save();

    // Populate complet de l'événement
    await event.populate([
      { path: "organizer", select: "firstname lastname nickname" },
      { path: "participants.user", select: "firstname lastname nickname" },
      {
        path: "participants.wishlist.purchasedBy",
        select: "firstname lastname nickname",
      },
    ]);

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
