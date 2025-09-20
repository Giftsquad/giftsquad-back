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
  WISH_LIST_FOLDER_PATTERN,
} = require("../services/uploadService");
const isParticipant = require("../middlewares/isParticipant");

const router = express.Router();

// Ajout d'un cadeau à la liste d'anniversaire
router.post(
  "/:id/gift-list",
  isAuthenticated,
  isAdmin,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const event = req.event;
      // Si ce n'est pas une Liste d'anniversaire, il n'y a pas de liste de cadeaux
      if (event.event_type.toLowerCase() !== Event.TYPES.birthday.toLowerCase()) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      // On teste la validité de l'image ici car express-validator ne prend pas en compte les files
      const image = req.files?.image;
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

      // Si la liste de cadeaux n'est pas initialisée, on l'initialise
      if (!event.giftList) {
        event.giftList = [];
      }

      // On ajoute le cadeau à la liste
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

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Modification d'un cadeau de la liste d'anniversaire
router.put(
  "/:id/gift-list/:giftId",
  isAuthenticated,
  isAdmin,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const event = req.event;
      // Si ce n'est pas une Liste d'anniversaire, il n'y a pas de liste de cadeaux
      if (Event.TYPES.birthday !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      // On teste la validité de l'image ici car express-validator ne prend pas en compte les files
      // Si l'image n'est pas renseignée, on conserve celle uploadée à la création
      const image = req.files?.image;
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

      // On cherche le cadeau dans la liste et on met à jour ses données
      const gift = event.giftList.find((gift) => gift._id.equals(giftId));
      if (!gift) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      gift.name = name;
      gift.price = price;
      gift.url = url;

      // Si une nouvelle image a été uploadée, on supprime l'ancienne avant d'uploader la nouvelle
      if (image) {
        await destroyFile(gift.image);
        gift.image = await uploadFile(
          image,
          GIFT_LIST_FOLDER_PATTERN.replace("{eventId}", event._id)
        );
      }

      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Suppression d'un cadeau de la liste d'anniversaire
router.delete(
  "/:id/gift-list/:giftId",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const event = req.event;
      // Si ce n'est pas une Liste d'anniversaire, il n'y a pas de liste de cadeaux
      if (Event.TYPES.birthday !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      const { giftId } = req.params;

      // On récupère l'index du cadeau dans la liste pour pouvoir le supprimer
      const giftIndex = event.giftList.findIndex((gift) =>
        gift._id.equals(giftId)
      );
      if (-1 === giftIndex) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      // On supprime l'image uploadée avant de supprimer le cadeau de la liste
      await destroyFile(event.giftList[giftIndex].image);
      event.giftList.splice(giftIndex, 1);

      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Ajout d'un cadeau à la liste de souhaits
router.post(
  "/:id/wish-list",
  isAuthenticated,
  isParticipant,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const { event, participation } = req;
      // Si ce n'est pas une Liste de Noël, il n'y a pas de liste de souhaits
      if (Event.TYPES.christmas_list !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël ont des listes de souhaits",
        });
      }

      // On teste la validité de l'image ici car express-validator ne prend pas en compte les files
      const image = req.files?.image;
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

      // Si la liste de souhaits n'est pas initialisée, on l'initialise
      if (!participation.wishList) {
        participation.wishList = [];
      }

      // On ajoute le cadeau à la liste
      participation.wishList.push({
        name,
        price,
        url,
        image: await uploadFile(
          image,
          WISH_LIST_FOLDER_PATTERN.replace("{eventId}", event._id).replace(
            "{userId}",
            req.user._id
          )
        ),
      });
      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Modification d'un cadeau de la liste de souhaits
router.put(
  "/:id/wish-list/:giftId",
  isAuthenticated,
  isParticipant,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const { event, participation } = req;
      // Si ce n'est pas une Liste de Noël, il n'y a pas de liste de souhaits
      if (Event.TYPES.christmas_list !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël ont des listes de souhaits",
        });
      }

      // On teste la validité de l'image ici car express-validator ne prend pas en compte les files
      // Si l'image n'est pas renseignée, on conserve celle uploadée à la création
      const image = req.files?.image;
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

      // On cherche le cadeau dans la liste et on met à jour ses données
      const gift = participation.wishList?.find((gift) =>
        gift._id.equals(giftId)
      );
      if (!gift) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      gift.name = name;
      gift.price = price;
      gift.url = url;

      // Si une nouvelle image a été uploadée, on supprime l'ancienne avant d'uploader la nouvelle
      if (image) {
        await destroyFile(gift.image);
        gift.image = await uploadFile(
          image,
          WISH_LIST_FOLDER_PATTERN.replace("{eventId}", event._id).replace(
            "{userId}",
            req.user._id
          )
        );
      }

      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Suppression d'un cadeau de la liste de souhaits
router.delete(
  "/:id/wish-list/:giftId",
  isAuthenticated,
  isParticipant,
  async (req, res) => {
    try {
      const { event, participation } = req;
      // Si ce n'est pas une Liste de Noël, il n'y a pas de liste de souhaits
      if (Event.TYPES.christmas_list !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël ont des listes de souhaits",
        });
      }

      const { giftId } = req.params;

      // On récupère l'index du cadeau dans la liste pour pouvoir le supprimer
      const giftIndex = participation.wishList?.findIndex((gift) =>
        gift._id.equals(giftId)
      );
      if (-1 === giftIndex) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      // On supprime l'image uploadée avant de supprimer le cadeau de la liste
      await destroyFile(participation.wishList[giftIndex].image);
      participation.wishList.splice(giftIndex, 1);

      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Déclarer s'occuper d'un cadeau
router.put(
  "/:id/wish-list/:giftId/purchase",
  isAuthenticated,
  isParticipant,
  async (req, res) => {
    try {
      const { event, participation } = req;
      // Si ce n'est pas une Liste de Noël, il n'y a pas de liste de souhaits
      if (Event.TYPES.christmas_list !== event.event_type) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël ont des listes de souhaits",
        });
      }

      const { giftId } = req.params;

      // On cherche le cadeau dans la liste
      const gift = participation.wishList?.find((gift) =>
        gift._id.equals(giftId)
      );
      if (!gift) {
        return res.status(404).json({ message: "Cadeau introuvable" });
      }

      // Si quelqu'un s'occupe déjà du cadeau, on renvoie une erreur
      if (gift.purchasedBy) {
        return res.status(409).json({
          message: "Il y a déjà une personne qui s'occupe de ce cadeau",
        });
      }
      // On associe l'utilisateur au cadeau
      gift.purchasedBy = req.user;

      await event.save();

      res.status(200).json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
