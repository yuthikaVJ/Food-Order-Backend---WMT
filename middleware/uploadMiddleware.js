const multer = require("multer");

const storage = multer.memoryStorage();
const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error("Only JPG, JPEG, PNG, and WEBP image files are allowed"));
      return;
    }

    cb(null, true);
  },
});

module.exports = upload;
