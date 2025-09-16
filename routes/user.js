const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const express = require("express");
const User = require("../models/User");
const {
  userLoginValidators,
  userSignupValidators,
  userUpdateValidators,
} = require("../validation/User");
const { matchedData } = require("express-validator");
const isAuthenticated = require("../middlewares/isAuthenticated");
const router = express.Router();

// SIGNUP
router.post("/signup", userSignupValidators, async (req, res) => {
  try {
    const { email, firstname, lastname, nickname, password } = matchedData(req);

    const existingByEmail = await User.findOne({ email });
    if (existingByEmail) {
      return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const existingByNickname = await User.findOne({ nickname });
    if (existingByNickname) {
      return res.status(409).json({ message: "Ce pseudo est déjà utilisé" });
    }

    const salt = uid2(64);
    const hash = SHA256(password + salt).toString(encBase64);
    const token = uid2(64);

    const newUser = new User({
      email,
      firstname,
      lastname,
      nickname,
      token,
      hash,
      salt,
    });
    await newUser.save();

    return res.status(201).json(getShowableUser(newUser));
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// LOGIN
router.post("/login", userLoginValidators, async (req, res) => {
  try {
    const { email, password } = matchedData(req);

    // Login normal avec email et password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const newHash = SHA256(password + user.salt).toString(encBase64);
    if (newHash !== user.hash) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json(getShowableUser(user));
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// VALIDATE TOKEN
router.post("/validate", async (req, res) => {
  try {
    // Vérifier si on a un token dans le header
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const user = await User.findOne({ token });
      if (user) {
        return res.status(200).json(getShowableUser(user));
      }
    }
    return res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// UPDATE
router.put(
  "/update",
  isAuthenticated,
  userUpdateValidators,
  async (req, res) => {
    try {
      const { email, firstname, lastname, nickname } = matchedData(req);

      const existingByEmail = await User.findOne({ email });
      if (existingByEmail && !existingByEmail._id.equals(req.user._id)) {
        return res.status(409).json({ message: "Cet email est déjà utilisé" });
      }

      const existingByNickname = await User.findOne({ nickname });
      if (existingByNickname && !existingByNickname._id.equals(req.user._id)) {
        return res.status(409).json({ message: "Ce pseudo est déjà utilisé" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { email, firstname, lastname, nickname },
        {
          new: true,
        }
      );
      return res.status(200).json(getShowableUser(updatedUser));
    } catch (error) {
      return res.status(500).json({ message: error });
    }
  }
);

module.exports = router;

const getShowableUser = (user) => {
  return {
    _id: user._id,
    token: user.token,
    firstname: user.firstname,
    lastname: user.lastname,
    nickname: user.nickname,
    email: user.email,
    events: user.events,
  };
};
