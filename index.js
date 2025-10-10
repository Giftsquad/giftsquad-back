const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(express.json());

// CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

mongoose.connect(process.env.MONGODB_URI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { setupGiftSquadFolder } = require("./services/uploadService");

// Configurer le dossier racine au démarrage
setupGiftSquadFolder();

const userRoutes = require("./routes/user");
const eventRoutes = require("./routes/event");
const giftRoutes = require("./routes/gift");

app.use("/user", userRoutes);
app.use("/event", eventRoutes);
app.use("/gifts", giftRoutes);

app.get("/", (req, res) => {
  try {
    return res.status(200).json("giftsquad server");
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.all(/.*/, (req, res) => {
  return res.status(404).json({ message: "Not found" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
