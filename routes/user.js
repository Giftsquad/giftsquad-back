const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const isAuthenticated = require("../middlewares/isAuthenticated");

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { firstname, lastname, nickname, email, password } = req.body;
    if (!firstname || !lastname || !nickname || !email || !password) {
      return res.status(400).json({ message: "Missing parameters" });
    }
    const user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ message: "User already exists" });
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
    return res.status(201).json({
      _id: newUser._id,
      token: newUser.token,
      firstname: newUser.firstname,
      lastname: newUser.lastname,
      nickname: newUser.nickname,
    });
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" }); // flou
    }
    const newHash = SHA256(password + user.salt).toString(encBase64);
    if (newHash !== user.hash) {
      return res.status(401).json({ message: "Unauthorized" }); // flou
    }
    return res.status(200).json({
      _id: user._id,
      token: user.token,
      firstname: user.firstname,
      lastname: user.lastname,
      nickname: user.nickname,
    });
  } catch (error) {
    return res.status(500).json({ message: error });
  }
});

module.exports = router;
