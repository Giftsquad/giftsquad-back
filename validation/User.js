const { body } = require("express-validator");
const handleValidationErrors = require("../middlewares/handleValidationErrors");
const User = require("../models/User");

const userSignupValidators = [
  body("email")
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail()
    .custom(async (email, { req }) => {
      const existing = await User.findOne({ email });
      if (existing) {
        throw new Error("Cet email est déjà utilisé");
      }
      return true;
    }),
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
    .withMessage("Le pseudo doit faire entre 2 et 30 caractères")
    .custom(async (nickname, { req }) => {
      const existing = await User.findOne({ nickname });
      if (existing) {
        throw new Error("Ce pseudo est déjà utilisé");
      }
      return true;
    }),
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
    .normalizeEmail()
    .custom(async (email, { req }) => {
      const existing = await User.findOne({ email });
      if (existing && !existing._id.equals(req.user._id)) {
        throw new Error("Cet email est déjà utilisé woulah");
      }
      return true;
    }),
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
    .withMessage("Le pseudo doit faire entre 2 et 30 caractères")
    .custom(async (nickname, { req }) => {
      const existing = await User.findOne({ nickname });
      if (existing && !existing._id.equals(req.user._id)) {
        throw new Error("Ce pseudo est déjà utilisé woulah");
      }
      return true;
    }),
  handleValidationErrors,
];

module.exports = {
  userLoginValidators,
  userSignupValidators,
  userUpdateValidators,
};
