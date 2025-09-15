const mongoose = require("mongoose");

// Schéma pour les gifts (utilisé pour wishlist et gifts)
const giftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    default: 0,
  },
  images: [
    {
      type: String,
      trim: true,
    },
  ],
  url: {
    type: String,
    trim: true,
  },
  priority: {
    type: String,
    enum: ["high", "medium", "low"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["planned", "purchased", "delivered"],
    default: "planned",
  },
  link: {
    type: String,
    trim: true,
  },
  // Pour la wishlist : qui a acheté ce cadeau
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  purchased: {
    type: Boolean,
    default: false,
  },
  // Pour les gifts : qui reçoit ce cadeau
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // Pour les gifts : qui offre ce cadeau
  giver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["secret_santa", "birthday", "christmas"],
    default: "secret_santa",
  },
  description: {
    type: String,
    trim: true,
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  date: {
    type: Date,
    required: true,
  },
  budget: {
    type: Number,
    required: true,
    default: 0,
  },
  status: {
    type: String,
    enum: ["draft", "active", "completed", "cancelled"],
    default: "draft",
  },
  // Participants de l'événement
  participants: [
    {
      _id: false,
      // Référence vers l'utilisateur
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      // Rôle dans l'événement
      role: {
        type: String,
        enum: ["organizer", "participant"],
        default: "participant",
      },
      // Statut de participation
      status: {
        type: String,
        enum: ["invited", "accepted", "declined"],
        default: "invited",
      },
      // Date d'arrivée dans l'événement
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      // Liste de souhaits : ce que cet utilisateur SOUHAITE recevoir
      wishlist: [giftSchema],
      // Assignations Secret Santa
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
      // Cadeau que cet utilisateur VA OFFRIR
      gift: giftSchema,
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

// Middleware pour mettre automatiquement à jour la date de updatedAt à chaque save()
eventSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
