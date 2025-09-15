const { validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Données non-valides", errors: errors.array() });
  }
  next();
};

module.exports = handleValidationErrors;
