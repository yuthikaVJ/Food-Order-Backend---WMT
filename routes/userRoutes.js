const express = require("express");

const {
  createUserByAdmin,
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getUserById,
  updateUserByAdmin,
  changeUserRole,
  deleteUserByAdmin,
} = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router
  .route("/profile")
  .get(protect, getMyProfile)
  .put(protect, upload.single("profileImage"), updateMyProfile);

router
  .route("/")
  .post(
    protect,
    authorizeRoles("admin"),
    upload.single("profileImage"),
    createUserByAdmin
  )
  .get(protect, authorizeRoles("admin"), getAllUsers);

router
  .route("/:id")
  .get(protect, authorizeRoles("admin"), getUserById)
  .put(
    protect,
    authorizeRoles("admin"),
    upload.single("profileImage"),
    updateUserByAdmin
  )
  .delete(protect, authorizeRoles("admin"), deleteUserByAdmin);

router
  .route("/:id/role")
  .patch(protect, authorizeRoles("admin"), changeUserRole);

module.exports = router;