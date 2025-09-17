const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const GIFT_LIST_FOLDER_PATTERN = "giftsquad/gift-list/{eventId}/";

const uploadFile = async (uploadedFile, prefix) => {
  return await cloudinary.uploader.upload(convertFileToBase64(uploadedFile), {
    asset_folder: prefix,
    use_asset_folder_as_public_id_prefix: true,
  });
};

const destroyFile = async (resource) => {
  await cloudinary.uploader.destroy(resource.public_id);
};

const destroyFolder = async (folder) => {
  const { resources = [] } = await cloudinary.api.resources_by_asset_folder(
    folder
  );

  // Supprimer toutes les resources
  for (const resource of resources) {
    await destroyFile(resource);
  }

  // Supprimer le dossier
  await cloudinary.api.delete_folder(folder);
};

const convertFileToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

module.exports = {
  GIFT_LIST_FOLDER_PATTERN,
  uploadFile,
  destroyFile,
  destroyFolder,
};
