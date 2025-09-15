const { body } = require("express-validator");
const handleValidationErrors = require("../middlewares/handleValidationErrors");

const userSignupValidators = [
  body("email")
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),
  body("firstname")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le prénom doit faire entre 2 et 30 caractères"),

  body("lastname")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le nom doit faire entre 2 et 30 caractères"),
  body("nickname")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le pseudo doit faire entre 2 et 30 caractères"),
  body("password")
    .notEmpty()
    .isLength({ min: 6 })
    .withMessage("Le mot de passe doit contenir au moins 6 caractères"),
  handleValidationErrors,
];

const userLoginValidators = [
  body("email")
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Le mot de passe est requis"),
  handleValidationErrors,
];

const userUpdateValidators = [
  body("email")
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),
  body("firstname")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le prénom doit faire entre 2 et 30 caractères"),

  body("lastname")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le nom doit faire entre 2 et 30 caractères"),
  body("nickname")
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le pseudo doit faire entre 2 et 30 caractères"),
  handleValidationErrors,
];

module.exports = {
  userLoginValidators,
  userSignupValidators,
  userUpdateValidators,
};
