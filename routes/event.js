const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const User = require("../models/User");

// Create event
router.post("/event/publish", async (req, res) => {
  //isAuthenticated
  try {
    const newEvent = new Event({
      event_type: req.body.type,
      event_name: req.body.name,
      event_date: req.body.date,
      event_budget: req.body.budget,
      event_organizer: req.body.organizerId, //req.user._id j'ai modifié pour pouvoir faire mes test sur postman
      event_participants: req.body.participants || [],
    });
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Read All Event
router.get("/event", async (req, res) => {
  //isAuthenticated
  try {
    const events = await Event.find().populate("event_organizer");
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Read specific Event
router.get("/event/:id", async (req, res) => {
  //isAuthenticated
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

//Update Event //add participants
router.put("/event/:id", async (req, res) => {
  //isAuthenticated isAdmin
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

//Delete Event
router.delete("/event/:id", async (req, res) => {
  //isAuthenticated, isAdmin,
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
