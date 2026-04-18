const express = require("express");

const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getCategories)
  .post(protect, authorizeRoles("admin"), createCategory);

router
  .route("/:id")
  .get(getCategoryById)
  .put(protect, authorizeRoles("admin"), updateCategory)
  .delete(protect, authorizeRoles("admin"), deleteCategory);

module.exports = router;
