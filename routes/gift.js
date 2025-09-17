const express = require("express");
const fileUpload = require("express-fileupload");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const { eventGiftValidators } = require("../validation/Event");
const { matchedData } = require("express-validator");
const Event = require("../models/Event");
const {
  uploadFile,
  destroyFile,
  GIFT_LIST_FOLDER_PATTERN,
} = require("../services/uploadService");

const router = express.Router();

router.post(
  "/:id/gift-list",
  isAuthenticated,
  isAdmin,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const event = req.event;
      if (Event.TYPES.birthday !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      const image = req.files?.image ?? null;
      if (
        !image ||
        "object" !== typeof image ||
        !image.data ||
        !image.mimetype.includes("image")
      ) {
        return res.status(400).json({
          message: "L'image du cadeau doit être une image valide",
        });
      }

      const { name, price, url } = matchedData(req);

      event.giftList.push({
        name,
        price,
        url,
        image: await uploadFile(
          image,
          GIFT_LIST_FOLDER_PATTERN.replace("{eventId}", event._id)
        ),
      });
      await event.save();

      return res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.put(
  "/:id/gift-list/:giftId",
  isAuthenticated,
  isAdmin,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const event = req.event;
      if (Event.TYPES.birthday !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      const image = req.files?.image ?? null;
      if (
        image &&
        ("object" !== typeof image ||
          !image.data ||
          !image.mimetype.includes("image"))
      ) {
        return res.status(400).json({
          message: "L'image du cadeau doit être une image valide",
        });
      }

      const { name, price, url } = matchedData(req);
      const { giftId } = req.params;

      const gift = event.giftList.find((gift) => gift._id.equals(giftId));
      if (!gift) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      gift.name = name;
      gift.price = price;
      gift.url = url;

      if (image) {
        await destroyFile(gift.image);
        gift.image = await uploadFile(
          image,
          GIFT_LIST_FOLDER_PATTERN.replace("{eventId}", event._id)
        );
      }

      await event.save();

      return res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  "/:id/gift-list/:giftId",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const event = req.event;
      if (Event.TYPES.birthday !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      const { giftId } = req.params;

      const giftIndex = event.giftList.findIndex((gift) =>
        gift._id.equals(giftId)
      );
      if (-1 === giftIndex) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      await destroyFile(event.giftList[giftIndex].image);

      event.giftList.splice(giftIndex, 1);

      await event.save();

      return res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
