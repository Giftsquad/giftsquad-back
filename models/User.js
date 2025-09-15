const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  firstname: {
    type: String,
    required: true,
    minLength: 2,
    maxLength: 30,
    unique: true,
    trim: true,
  },
  lastname: {
    type: String,
    required: true,
    minLength: 2,
    maxLength: 30,
    trim: true,
  },
  nickname: {
    type: String,
    required: true,
    minLength: 2,
    maxLength: 30,
    trim: true,
  },
  token: {
    type: String,
    required: true,
  },
  hash: {
    type: String,
    required: true,
  },
  salt: {
    type: String,
    required: true,
  },
  events: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
