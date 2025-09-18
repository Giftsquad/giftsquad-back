const mongoose = require("mongoose");

// Utilisation de constantes pour les champs enum
const TYPES = {
  secret_santa: "Secret Santa",
  christmas_list: "Christmas List",
  birthday: "Birthday",
};
const PARTICIPANT_ROLES = {
  participant: "participant",
  organizer: "organizer",
};
const PARTICIPANT_STATUSES = {
  invited: "invited",
  accepted: "accepted",
  declined: "declined",
};

// Schéma pour les gifts (utilisé pour wishList et giftList)
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
  },
  image: {
    type: Object,
    required: true,
  },
  url: {
    type: String,
    trim: true,
  },
  // Pour la liste de Noël : qui a acheté ce cadeau
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // Rajouter status {planned: "planned", purchased: "purchased"} si on veut dire que tel cadeau est sélectionné pour la liste d'anniversaire
  // Rajouter priority {low: "low", medium: "medium", high: "high"} ou Number (avec 0 = low, 100 = high) si on veut hierarchiser les cadeaux
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const eventSchema = new mongoose.Schema({
  event_type: {
    type: String,
    enum: Object.values(TYPES),
    required: true,
    trim: true,
  },
  event_name: { type: String, required: true, trim: true },
  event_date: { type: Date, required: true },
  event_budget: { type: Number, default: 0 },
  event_organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  event_participants: [
    // Ajouter les infos des participants pour envoyer une invitation ou la notification sur l'app
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      email: { type: String, required: true, trim: true },
      // Définir le rôle pour définir les droits d'administrateurs afin de voir qui a pioché qui
      role: {
        type: String,
        enum: Object.values(PARTICIPANT_ROLES),
        default: PARTICIPANT_ROLES.participant,
      },
      // Statut de participation
      status: {
        type: String,
        enum: Object.values(PARTICIPANT_STATUSES),
        default: PARTICIPANT_STATUSES.invited,
      },
      // Date d'arrivée dans l'événement
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      // Pour la liste d'anniversaire : Montant de la participation
      participationAmount: {
        type: Number,
      },
      // Pour le Secret Santa : À qui cet utilisateur doit offrir un cadeau
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      // Pour le Secret Santa : Qui doit offrir un cadeau à cet utilisateur
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      // Pour la liste de Noël : liste des cadeaux souhaités
      wishList: [giftSchema],
    },
  ],
  // Date du tirage au sort pour le Secret Santa
  drawnAt: {
    type: Date,
  },
  // Pour la liste d'anniversaire : liste des cadeaux à offrir
  giftList: [giftSchema],
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

// Ajout des constantes au schema pour pouvoir les utiliser à la validation ou la création/modification
eventSchema.statics.TYPES = TYPES;
eventSchema.statics.PARTICIPANT_ROLES = PARTICIPANT_ROLES;
eventSchema.statics.PARTICIPANT_STATUSES = PARTICIPANT_STATUSES;

// Ajout d'un index sur le champ email du participant pour accélérer les recherches
eventSchema.index({ "event_participants.email": 1 });

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
