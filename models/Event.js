const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  event_type: {
    type: String,
    enum: ["Secret Santa", "Christmast List", "Birthday"],
    required: true,
    trim: true,
  },
  event_name: { type: String, required: true, trim: true },
  event_date: { type: Date, required: true },
  event_budget: { type: Number, required: true, default: 0 },
  event_organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  event_participants: [
    // Ajouter les infos des participants pour envoyer une invitation ou la notification sur l'app
    {
      participant: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true },
      },
      // Définir le rôle pour définir les droits d'administrateurs afin de voir qui a pioché qui
      role: {
        type: String,
        enum: ["organizer", "participant"],
        default: "participant",
      },
      // À qui cet utilisateur doit offrir un cadeau
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      // Qui doit offrir un cadeau à cet utilisateur
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

eventSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
