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
  createFolder,
  EVENT_FOLDER_PATTERN,
} = require("../services/uploadService");
const isParticipant = require("../middlewares/isParticipant");

const router = express.Router();

// Ajout d'un cadeau à la liste d'anniversaire
router.post(
  "/:id/gift-list",
  isAuthenticated,
  isParticipant,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const event = req.event;
      // Si ce n'est pas une Liste d'anniversaire, il n'y a pas de liste de cadeaux
      if (
        event.event_type.toLowerCase() !== Event.TYPES.birthday.toLowerCase()
      ) {
        return res.status(400).json({
          message:
            "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
        });
      }

      // On teste la validité des images ici car express-validator ne prend pas en compte les files
      const images = req.files?.images;
      let uploadedImages = [];

      if (images) {
        // Si c'est un seul fichier, on le met dans un tableau
        const imageArray = Array.isArray(images) ? images : [images];

        // Vérifier que toutes les images sont valides
        for (const image of imageArray) {
          if (
            "object" !== typeof image ||
            !image.data ||
            !image.mimetype.includes("image")
          ) {
            return res.status(400).json({
              message:
                "Toutes les images du cadeau doivent être des images valides",
            });
          }
        }

        // Uploader toutes les images
        for (let i = 0; i < imageArray.length; i++) {
          const image = imageArray[i];
          const eventFolder = EVENT_FOLDER_PATTERN.replace(
            "{eventId}",
            event._id
          );
          const publicId = `gift_${Date.now()}_${i}`; // ID unique pour chaque image
          const uploadedImage = await uploadFile(image, eventFolder, publicId);
          uploadedImages.push(uploadedImage);
        }
      }

      const { name, price, url } = matchedData(req);

      // Vérifier que l'utilisateur est valide
      if (!req.user || !req.user._id) {
        return res.status(401).json({ message: "Utilisateur invalide" });
      }

      // Si la liste de cadeaux n'est pas initialisée, on l'initialise
      if (!event.giftList) {
        event.giftList = [];
      }

      // Créer le dossier Cloudinary pour cet événement s'il n'existe pas
      try {
        const eventFolder = EVENT_FOLDER_PATTERN.replace(
          "{eventId}",
          event._id
        );
        await createFolder(eventFolder);
        console.log(`Dossier Cloudinary créé: ${eventFolder}`);
      } catch (folderError) {
        console.error(
          "Erreur lors de la création du dossier Cloudinary:",
          folderError
        );
        // On continue même si la création du dossier échoue
      }

      // On ajoute le cadeau à la liste
      event.giftList.push({
        name,
        price,
        url,
        images: uploadedImages,
        addedBy: req.user._id,
      });
      await event.save();

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Modification d'un cadeau de la liste d'anniversaire
router.put(
  "/:id/gift-list/:giftId",
  isAuthenticated,
  isParticipant,
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

      // On teste la validité des images ici car express-validator ne prend pas en compte les files
      // Si les images ne sont pas renseignées, on conserve celles uploadées à la création
      const images = req.files?.images;
      let uploadedImages = [];

      if (images) {
        // Si c'est un seul fichier, on le met dans un tableau
        const imageArray = Array.isArray(images) ? images : [images];

        // Vérifier que toutes les images sont valides
        for (const image of imageArray) {
          if (
            "object" !== typeof image ||
            !image.data ||
            !image.mimetype.includes("image")
          ) {
            return res.status(400).json({
              message:
                "Toutes les images du cadeau doivent être des images valides",
            });
          }
        }

        // Uploader toutes les nouvelles images
        for (let i = 0; i < imageArray.length; i++) {
          const image = imageArray[i];
          const eventFolder = EVENT_FOLDER_PATTERN.replace(
            "{eventId}",
            event._id
          );
          const publicId = `gift_${Date.now()}_${i}`; // ID unique pour chaque image
          const uploadedImage = await uploadFile(image, eventFolder, publicId);
          uploadedImages.push(uploadedImage);
        }
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

      // Si de nouvelles images ont été uploadées, on supprime les anciennes avant d'uploader les nouvelles
      if (images && uploadedImages.length > 0) {
        // Supprimer les anciennes images
        if (gift.images && gift.images.length > 0) {
          for (const oldImage of gift.images) {
            await destroyFile(oldImage);
          }
        }
        gift.images = uploadedImages;
      }

      await event.save();

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Suppression d'un cadeau de la liste d'anniversaire
router.delete("/:id/gift-list/:giftId", isAuthenticated, async (req, res) => {
  try {
    const { id, giftId } = req.params;
    const userId = req.user._id;

    // Récupérer l'événement
    const event = await Event.findById(id)
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("giftList.addedBy");

    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }

    // Si ce n'est pas une Liste d'anniversaire, il n'y a pas de liste de cadeaux
    if (Event.TYPES.birthday !== event.event_type) {
      return res.status(400).json({
        message:
          "Seuls les évènements Listes d'anniversaire ont une liste de cadeaux",
      });
    }

    // Vérifier si l'utilisateur est l'organisateur
    const isOrganizer =
      event.event_organizer._id.toString() === userId.toString();

    // On récupère l'index du cadeau dans la liste pour pouvoir le supprimer
    const giftIndex = event.giftList.findIndex(
      (gift) => gift._id.toString() === giftId
    );
    if (-1 === giftIndex) {
      return res.status(404).json({ message: "Cadeau introuvable" });
    }

    const gift = event.giftList[giftIndex];

    // Vérifier si l'utilisateur est l'auteur du cadeau
    const isAuthor =
      gift.addedBy && gift.addedBy._id.toString() === userId.toString();

    // Vérifier les permissions : organisateur OU auteur du cadeau
    if (!isOrganizer && !isAuthor) {
      return res.status(403).json({
        message:
          "Vous n'êtes pas autorisé à supprimer ce cadeau. Seul l'organisateur ou l'auteur du cadeau peut le faire.",
      });
    }

    // On supprime les images uploadées avant de supprimer le cadeau de la liste
    if (
      event.giftList[giftIndex].images &&
      event.giftList[giftIndex].images.length > 0
    ) {
      for (const image of event.giftList[giftIndex].images) {
        await destroyFile(image);
      }
    }
    event.giftList.splice(giftIndex, 1);

    await event.save();

    // Récupérer l'événement avec les données populées
    const populatedEvent = await Event.findById(event._id)
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy");

    res.status(200).json(populatedEvent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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
      // Si ce n'est pas une Liste de Noël ou un Secret Santa, il n'y a pas de liste de souhaits
      if (
        Event.TYPES.christmas_list !== event.event_type &&
        Event.TYPES.secret_santa !== event.event_type
      ) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël et Secret Santa ont des listes de souhaits",
        });
      }

      // On teste la validité des images ici car express-validator ne prend pas en compte les files
      const images = req.files?.images;
      let uploadedImages = [];

      if (images) {
        // Si c'est un seul fichier, on le met dans un tableau
        const imageArray = Array.isArray(images) ? images : [images];

        // Vérifier que toutes les images sont valides
        for (const image of imageArray) {
          if (
            "object" !== typeof image ||
            !image.data ||
            !image.mimetype.includes("image")
          ) {
            return res.status(400).json({
              message:
                "Toutes les images du cadeau doivent être des images valides",
            });
          }
        }

        // Uploader toutes les images
        for (let i = 0; i < imageArray.length; i++) {
          const image = imageArray[i];
          const eventFolder = EVENT_FOLDER_PATTERN.replace(
            "{eventId}",
            event._id
          );
          const publicId = `wish_${Date.now()}_${i}`; // ID unique pour chaque image
          const uploadedImage = await uploadFile(image, eventFolder, publicId);
          uploadedImages.push(uploadedImage);
        }
      }

      const { name, price, url } = matchedData(req);

      // Vérifier que l'utilisateur est valide
      if (!req.user || !req.user._id) {
        return res.status(401).json({ message: "Utilisateur invalide" });
      }

      // Si la liste de souhaits n'est pas initialisée, on l'initialise
      if (!participation.wishList) {
        participation.wishList = [];
      }

      // Créer le dossier Cloudinary pour cet événement s'il n'existe pas
      try {
        const eventFolder = EVENT_FOLDER_PATTERN.replace(
          "{eventId}",
          event._id
        );
        await createFolder(eventFolder);
        console.log(`Dossier Cloudinary créé: ${eventFolder}`);
      } catch (folderError) {
        console.error(
          "Erreur lors de la création du dossier Cloudinary:",
          folderError
        );
        // On continue même si la création du dossier échoue
      }

      // On ajoute le cadeau à la liste
      participation.wishList.push({
        name,
        price,
        url,
        images: uploadedImages,
        addedBy: req.user._id,
      });
      await event.save();

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
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
      // Si ce n'est pas une Liste de Noël ou un Secret Santa, il n'y a pas de liste de souhaits
      if (
        Event.TYPES.christmas_list !== event.event_type &&
        Event.TYPES.secret_santa !== event.event_type
      ) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël et Secret Santa ont des listes de souhaits",
        });
      }

      // On teste la validité des images ici car express-validator ne prend pas en compte les files
      // Si les images ne sont pas renseignées, on conserve celles uploadées à la création
      const images = req.files?.images;
      let uploadedImages = [];

      if (images) {
        // Si c'est un seul fichier, on le met dans un tableau
        const imageArray = Array.isArray(images) ? images : [images];

        // Vérifier que toutes les images sont valides
        for (const image of imageArray) {
          if (
            "object" !== typeof image ||
            !image.data ||
            !image.mimetype.includes("image")
          ) {
            return res.status(400).json({
              message:
                "Toutes les images du cadeau doivent être des images valides",
            });
          }
        }

        // Uploader toutes les nouvelles images
        for (let i = 0; i < imageArray.length; i++) {
          const image = imageArray[i];
          const eventFolder = EVENT_FOLDER_PATTERN.replace(
            "{eventId}",
            event._id
          );
          const publicId = `wish_${Date.now()}_${i}`; // ID unique pour chaque image
          const uploadedImage = await uploadFile(image, eventFolder, publicId);
          uploadedImages.push(uploadedImage);
        }
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

      // Si de nouvelles images ont été uploadées, on supprime les anciennes avant d'uploader les nouvelles
      if (images && uploadedImages.length > 0) {
        // Supprimer les anciennes images
        if (gift.images && gift.images.length > 0) {
          for (const oldImage of gift.images) {
            await destroyFile(oldImage);
          }
        }
        gift.images = uploadedImages;
      }

      await event.save();

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
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
      // Si ce n'est pas une Liste de Noël ou un Secret Santa, il n'y a pas de liste de souhaits
      if (
        Event.TYPES.christmas_list !== event.event_type &&
        Event.TYPES.secret_santa !== event.event_type
      ) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël et Secret Santa ont des listes de souhaits",
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

      // On supprime les images uploadées avant de supprimer le cadeau de la liste
      if (
        participation.wishList[giftIndex].images &&
        participation.wishList[giftIndex].images.length > 0
      ) {
        for (const image of participation.wishList[giftIndex].images) {
          await destroyFile(image);
        }
      }
      participation.wishList.splice(giftIndex, 1);

      await event.save();

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
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
      // Si ce n'est pas une Liste de Noël ou un Secret Santa, il n'y a pas de liste de souhaits
      if (
        Event.TYPES.christmas_list !== event.event_type &&
        Event.TYPES.secret_santa !== event.event_type
      ) {
        return res.status(400).json({
          message:
            "Seuls les évènements Liste de Noël et Secret Santa ont des listes de souhaits",
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

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Ajout d'un cadeau pour Secret Santa (route générique pour tous les participants)
router.post(
  "/:id/gift",
  isAuthenticated,
  isParticipant,
  fileUpload(),
  eventGiftValidators,
  async (req, res) => {
    try {
      const { event, participation } = req;

      // Vérifier que c'est un Secret Santa
      if (Event.TYPES.secret_santa !== event.event_type) {
        return res.status(400).json({
          message: "Cette route est réservée aux événements Secret Santa",
        });
      }

      // On teste la validité des images ici car express-validator ne prend pas en compte les files
      const images = req.files?.images;
      let uploadedImages = [];

      if (images) {
        // Si c'est un seul fichier, on le met dans un tableau
        const imageArray = Array.isArray(images) ? images : [images];

        // Vérifier que toutes les images sont valides
        for (const image of imageArray) {
          if (
            "object" !== typeof image ||
            !image.data ||
            !image.mimetype.includes("image")
          ) {
            return res.status(400).json({
              message:
                "Toutes les images du cadeau doivent être des images valides",
            });
          }
        }

        // Uploader toutes les images
        for (let i = 0; i < imageArray.length; i++) {
          const image = imageArray[i];
          const eventFolder = EVENT_FOLDER_PATTERN.replace(
            "{eventId}",
            event._id
          );
          const publicId = `gift_${Date.now()}_${i}`; // ID unique pour chaque image
          const uploadedImage = await uploadFile(image, eventFolder, publicId);
          uploadedImages.push(uploadedImage);
        }
      }

      const { name, price, url } = matchedData(req);

      // Vérifier que l'utilisateur est valide
      if (!req.user || !req.user._id) {
        return res.status(401).json({ message: "Utilisateur invalide" });
      }

      // Si la liste de cadeaux n'est pas initialisée, on l'initialise
      if (!event.giftList) {
        event.giftList = [];
      }

      // Créer le dossier Cloudinary pour cet événement s'il n'existe pas
      try {
        const eventFolder = EVENT_FOLDER_PATTERN.replace(
          "{eventId}",
          event._id
        );
        await createFolder(eventFolder);
        console.log(`Dossier Cloudinary créé: ${eventFolder}`);
      } catch (folderError) {
        console.error(
          "Erreur lors de la création du dossier Cloudinary:",
          folderError
        );
        // On continue même si la création du dossier échoue
      }

      // On ajoute le cadeau à la liste
      event.giftList.push({
        name,
        price,
        url,
        images: uploadedImages,
        addedBy: req.user._id,
      });
      await event.save();

      // Récupérer l'événement avec les données populées
      const populatedEvent = await Event.findById(event._id)
        .populate("event_organizer")
        .populate("event_participants.user")
        .populate("event_participants.wishList.addedBy")
        .populate("giftList.addedBy");

      res.status(200).json(populatedEvent);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Suppression d'un cadeau (route générique)
router.delete("/gift/:giftId", isAuthenticated, async (req, res) => {
  try {
    const { giftId } = req.params;
    const userId = req.user._id;

    // Trouver l'événement qui contient ce cadeau
    const event = await Event.findOne({
      $or: [
        { "giftList._id": giftId },
        { "event_participants.wishList._id": giftId },
      ],
    })
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy");

    if (!event) {
      return res.status(404).json({ message: "Cadeau introuvable" });
    }

    // Vérifier si l'utilisateur est l'organisateur
    const isOrganizer =
      event.event_organizer._id.toString() === userId.toString();

    // Vérifier si l'utilisateur est l'auteur du cadeau
    let isAuthor = false;
    let giftToDelete = null;

    // Chercher le cadeau dans giftList
    const giftIndexInGiftList = event.giftList.findIndex(
      (g) => g._id.toString() === giftId
    );
    if (giftIndexInGiftList !== -1) {
      giftToDelete = event.giftList[giftIndexInGiftList];
      if (giftToDelete.addedBy && giftToDelete.addedBy._id) {
        isAuthor = giftToDelete.addedBy._id.toString() === userId.toString();
      }
    }

    // Si pas trouvé dans giftList, chercher dans les wishLists des participants
    if (!giftToDelete) {
      for (const participant of event.event_participants) {
        const giftIndexInWishList = participant.wishList.findIndex(
          (g) => g._id.toString() === giftId
        );
        if (giftIndexInWishList !== -1) {
          giftToDelete = participant.wishList[giftIndexInWishList];
          if (giftToDelete.addedBy && giftToDelete.addedBy._id) {
            isAuthor =
              giftToDelete.addedBy._id.toString() === userId.toString();
          }
          break;
        }
      }
    }

    if (!isOrganizer && !isAuthor) {
      return res.status(403).json({
        message:
          "Vous n'êtes pas autorisé à supprimer ce cadeau. Seul l'organisateur ou l'auteur du cadeau peut le faire.",
      });
    }

    // Supprimer les images du cadeau avant de le supprimer de la base de données
    if (giftToDelete && giftToDelete.images && giftToDelete.images.length > 0) {
      for (const image of giftToDelete.images) {
        await destroyFile(image);
      }
    }

    // Supprimer le cadeau
    if (giftIndexInGiftList !== -1) {
      event.giftList.splice(giftIndexInGiftList, 1);
    } else {
      for (const participant of event.event_participants) {
        const giftIndexInWishList = participant.wishList.findIndex(
          (g) => g._id.toString() === giftId
        );
        if (giftIndexInWishList !== -1) {
          participant.wishList.splice(giftIndexInWishList, 1);
          break;
        }
      }
    }

    await event.save();

    // Récupérer l'événement mis à jour avec les données populées
    const updatedEvent = await Event.findById(event._id)
      .populate("event_organizer")
      .populate("event_participants.user")
      .populate("event_participants.wishList.addedBy")
      .populate("giftList.addedBy");

    res.status(200).json({
      message: "Cadeau supprimé avec succès.",
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du cadeau:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
