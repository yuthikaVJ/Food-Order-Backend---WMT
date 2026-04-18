const express = require("express");

const {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
} = require("../controllers/menuController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getMenuItems)
  .post(
    protect,
    authorizeRoles("admin"),
    upload.single("image"),
    createMenuItem
  );

router
  .route("/:id")
  .get(getMenuItemById)
  .put(
    protect,
    authorizeRoles("admin"),
    upload.single("image"),
    updateMenuItem
  )
  .delete(protect, authorizeRoles("admin"), deleteMenuItem);

module.exports = router;
