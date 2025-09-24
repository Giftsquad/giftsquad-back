const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const EVENT_FOLDER_PATTERN = "giftsquad/{eventId}/";

const uploadFile = async (uploadedFile, prefix, publicId = null) => {
  return await cloudinary.uploader.upload(
    `data:${uploadedFile.mimetype};base64,${uploadedFile.data.toString(
      "base64"
    )}`,
    {
      asset_folder: prefix,
      use_asset_folder_as_public_id_prefix: true,
      public_id: publicId, // Utiliser l'ID du cadeau comme nom de fichier
    }
  );
};

const destroyFile = async (resource) => {
  await cloudinary.uploader.destroy(resource.public_id);
};

const createFolder = async (folder) => {
  try {
    // Créer un fichier temporaire pour forcer la création du dossier
    const tempFile = {
      mimetype: "image/png",
      data: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64"
      ),
    };

    const result = await cloudinary.uploader.upload(
      `data:${tempFile.mimetype};base64,${tempFile.data.toString("base64")}`,
      {
        public_id: `${folder}.temp`,
        asset_folder: folder,
        use_asset_folder_as_public_id_prefix: true,
      }
    );

    // Supprimer immédiatement le fichier temporaire
    await cloudinary.uploader.destroy(result.public_id);

    return result;
  } catch (error) {
    console.error("Erreur lors de la création du dossier Cloudinary:", error);
    throw error;
  }
};

const destroyFolder = async (folder) => {
  try {
    const { resources = [] } = await cloudinary.api.resources_by_asset_folder(
      folder
    );

    // Supprimer toutes les resources
    for (const resource of resources) {
      await destroyFile(resource);
    }

    // Supprimer le dossier
    await cloudinary.api.delete_folder(folder);
  } catch (error) {
    // Si le dossier n'existe pas, on ignore l'erreur
    if (error.http_code === 404) {
      // console.log(`Dossier ${folder} n'existe pas, suppression ignorée`);
      return;
    }
    throw error;
  }
};

// Configurer le dossier racine giftsquad au démarrage
const setupGiftSquadFolder = async () => {
  const targetFolder = "giftsquad";

  try {
    // 1. Lister les dossiers à la racine
    const foldersResponse = await cloudinary.api.sub_folders("");
    const existingFolders = foldersResponse.folders.map((f) => f.name);

    // console.log("Dossiers trouvés à la racine :", existingFolders);

    // 2. Vérifier si le dossier "giftsquad" existe
    const giftsquadExists = existingFolders.includes(targetFolder);

    if (!giftsquadExists) {
      // console.log(`Le dossier "${targetFolder}" n'existe pas. Création...`);
      await cloudinary.api.create_folder(targetFolder);
    } else {
      // console.log(`Le dossier "${targetFolder}" existe déjà.`);
    }

    // 3. Supprimer tous les autres dossiers
    for (const folder of existingFolders) {
      if (folder !== targetFolder) {
        // console.log(`Suppression du dossier "${folder}"...`);

        // Supprime d'abord les fichiers du dossier
        await cloudinary.api.delete_resources_by_prefix(folder);

        // Supprime ensuite le dossier
        await cloudinary.api.delete_folder(folder);

        // console.log(`Dossier "${folder}" supprimé.`);
      }
    }

    // console.log(`Le dossier "${targetFolder}" est prêt à être utilisé.`);
  } catch (error) {
    console.error(
      "Erreur lors de la gestion des dossiers Cloudinary :",
      error.message
    );
  }
};

module.exports = {
  EVENT_FOLDER_PATTERN,
  uploadFile,
  destroyFile,
  createFolder,
  destroyFolder,
  setupGiftSquadFolder,
};
