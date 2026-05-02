const express = require("express");

const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getCategories)
  .post(
    protect,
    authorizeRoles("admin"),
    upload.single("categoryImage"),
    createCategory
  );

router
  .route("/:id")
  .get(getCategoryById)
  .put(
    protect,
    authorizeRoles("admin"),
    upload.single("categoryImage"),
    updateCategory
  )
  .delete(protect, authorizeRoles("admin"), deleteCategory);

module.exports = router;