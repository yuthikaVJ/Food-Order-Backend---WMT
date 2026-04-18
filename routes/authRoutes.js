const express = require("express");

const {
  registerUser,
  loginUser,
  getMyProfile,
  adminOnlyExample,
} = require("../controllers/authController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMyProfile);
router.get("/admin-only", protect, authorizeRoles("admin"), adminOnlyExample);

module.exports = router;
