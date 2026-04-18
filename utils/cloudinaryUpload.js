const cloudinary = require("../config/cloudinary");

const isCloudinaryConfigured = () => {
  const placeholderValues = [
    "your_cloud_name",
    "your_api_key",
    "your_api_secret",
  ];

  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    !placeholderValues.includes(process.env.CLOUDINARY_CLOUD_NAME) &&
    !placeholderValues.includes(process.env.CLOUDINARY_API_KEY) &&
    !placeholderValues.includes(process.env.CLOUDINARY_API_SECRET)
  );
};

const uploadImageToCloudinary = async (
  file,
  folder = "food-order-management"
) => {
  if (!file) {
    return {
      url: "",
      publicId: "",
    };
  }

  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Replace the placeholder CLOUDINARY values in backend/.env with real credentials from your Cloudinary dashboard"
    );
  }

  const base64Image = file.buffer.toString("base64");
  const dataUri = `data:${file.mimetype};base64,${base64Image}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) {
    return;
  }

  await cloudinary.uploader.destroy(publicId);
};

module.exports = {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
};
