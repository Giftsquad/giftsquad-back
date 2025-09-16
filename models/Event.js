const mongoose = require("mongoose");

// Utilisation de constantes pour les champs enum
const TYPES = {
  secret_santa: "Secret Santa",
  christmas_list: "Christmast List",
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
      participant: {
        name: { type: String, trim: true },
        email: { type: String, required: true, trim: true },
      },
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

// Ajout des constantes au schema pour pouvoir les utiliser à la validation ou la création/modification
eventSchema.statics.TYPES = TYPES;
eventSchema.statics.PARTICIPANT_ROLES = PARTICIPANT_ROLES;
eventSchema.statics.PARTICIPANT_STATUSES = PARTICIPANT_STATUSES;

// Ajout d'un index sur le champ email du participant pour accélérer les recherches
eventSchema.index({ "participants.participant.email": 1 });

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
