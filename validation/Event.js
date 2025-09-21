const { body } = require("express-validator");
const handleValidationErrors = require("../middlewares/handleValidationErrors");
const Event = require("../models/Event");

const eventCreateValidators = [
  body("type")
    .trim()
    .notEmpty()
    .isIn(Object.values(Event.TYPES))
    .withMessage(
      "Le type doit être l'une des valeurs suivantes : " +
        Object.values(Event.TYPES).join(", ")
    ),
  body("name")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le nom doit faire entre 2 et 30 caractères"),
  body("date")
    .trim()
    .notEmpty()
    .isDate()
    .withMessage("La date doit être valide")
    .isAfter(new Date().toISOString())
    .withMessage("La date doit être ultérieure à aujourd'hui"),
  body("budget")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Le budget recommandé doit être un montant supérieur à 0")
    .custom((budget, { req }) => {
      if (Event.TYPES.secret_santa === req.body.type && !budget) {
        throw new Error("Le budget recommandé est requis");
      }

      return true;
    }),
  handleValidationErrors,
];

const eventAddParticipantValidators = [
  body("email").trim().notEmpty().isEmail().withMessage("Email invalide"),
  handleValidationErrors,
];

const eventParticipationValidators = [
  body("amount")
    .notEmpty()
    .isFloat({ min: 0 })
    .withMessage("Le montant de la participation doit être supérieur à 0"),
  handleValidationErrors,
];

const eventGiftValidators = [
  body("name")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le nom doit faire entre 2 et 30 caractères"),
  body("price")
    .notEmpty()
    .isFloat({ min: 0 })
    .withMessage("Le prix doit être un montant supérieur à 0"),
  body("url")
    .optional({ checkFalsy: true }) // <-- url n'est pas obligatoire
    .isURL()
    .withMessage("Lien vers le produit invalide"),
  body("images")
    .optional()
    .isArray()
    .withMessage("Les images doivent être un tableau"),
  body("images.*")
    .optional()
    .isObject()
    .withMessage("Chaque image doit être un objet valide"),
  handleValidationErrors,
];

module.exports = {
  eventCreateValidators,
  eventAddParticipantValidators,
  eventGiftValidators,
  eventParticipationValidators,
};
