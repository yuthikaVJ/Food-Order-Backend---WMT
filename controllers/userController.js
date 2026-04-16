const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const User = require("../models/User");
const sanitizeUser = require("../utils/sanitizeUser");
const {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} = require("../utils/cloudinaryUpload");

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const createUserByAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, phone, address, role } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  const trimmedName = name.trim();
  const normalizedEmail = email.toLowerCase().trim();

  if (!trimmedName) {
    res.status(400);
    throw new Error("Name cannot be empty");
  }

  if (!normalizedEmail) {
    res.status(400);
    throw new Error("Email cannot be empty");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    res.status(400);
    throw new Error("User already exists with this email");
  }

  let profileImage = "";
  let profileImagePublicId = "";

  if (req.file) {
    const uploadedImage = await uploadImageToCloudinary(
      req.file,
      "food-order-management/profiles"
    );

    profileImage = uploadedImage.url;
    profileImagePublicId = uploadedImage.publicId;
  }

  const user = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    password,
    phone: typeof phone !== "undefined" ? phone.trim() : "",
    address: typeof address !== "undefined" ? address.trim() : "",
    role: role && ["user", "admin"].includes(role) ? role : "user",
    profileImage,
    profileImagePublicId,
  });

  res.status(201).json({
    success: true,
    message: "User created successfully",
    user: sanitizeUser(user),
  });
});

const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, address, password } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (typeof email !== "undefined") {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      res.status(400);
      throw new Error("Email cannot be empty");
    }

    const existingUser = await User.findOne({
      _id: { $ne: user._id },
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(400);
      throw new Error("Another user already uses this email");
    }

    user.email = normalizedEmail;
  }

  if (typeof name !== "undefined") {
    const trimmedName = name.trim();

    if (!trimmedName) {
      res.status(400);
      throw new Error("Name cannot be empty");
    }

    user.name = trimmedName;
  }

  if (typeof phone !== "undefined") {
    user.phone = phone.trim();
  }

  if (typeof address !== "undefined") {
    user.address = address.trim();
  }

  if (typeof password !== "undefined") {
    if (!password || password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters long");
    }

    user.password = password;
  }

  if (req.file) {
    const uploadedImage = await uploadImageToCloudinary(
      req.file,
      "food-order-management/profiles"
    );

    if (user.profileImagePublicId) {
      await deleteImageFromCloudinary(user.profileImagePublicId);
    }

    user.profileImage = uploadedImage.url;
    user.profileImagePublicId = uploadedImage.publicId;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: sanitizeUser(user),
  });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const filter = {};
  const { search, role } = req.query;

  if (search) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (role) {
    filter.role = role;
  }

  const users = await User.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users: users.map(sanitizeUser),
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid user ID");
  }

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({
    success: true,
    user: sanitizeUser(user),
  });
});

const updateUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid user ID");
  }

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (typeof email !== "undefined") {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      res.status(400);
      throw new Error("Email cannot be empty");
    }

    const existingUser = await User.findOne({
      _id: { $ne: user._id },
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(400);
      throw new Error("Another user already uses this email");
    }

    user.email = normalizedEmail;
  }

  if (typeof name !== "undefined") {
    const trimmedName = name.trim();

    if (!trimmedName) {
      res.status(400);
      throw new Error("Name cannot be empty");
    }

    user.name = trimmedName;
  }

  if (typeof phone !== "undefined") {
    user.phone = phone.trim();
  }

  if (typeof address !== "undefined") {
    user.address = address.trim();
  }

  if (req.file) {
    const uploadedImage = await uploadImageToCloudinary(
      req.file,
      "food-order-management/profiles"
    );

    if (user.profileImagePublicId) {
      await deleteImageFromCloudinary(user.profileImagePublicId);
    }

    user.profileImage = uploadedImage.url;
    user.profileImagePublicId = uploadedImage.publicId;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    user: sanitizeUser(user),
  });
});

const changeUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid user ID");
  }

  if (!role || !["user", "admin"].includes(role)) {
    res.status(400);
    throw new Error("Role must be either user or admin");
  }

  if (req.user._id.toString() === id && role !== "admin") {
    res.status(400);
    throw new Error("You cannot remove your own admin role");
  }

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: "User role updated successfully",
    user: sanitizeUser(user),
  });
});

const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid user ID");
  }

  if (req.user._id.toString() === id) {
    res.status(400);
    throw new Error("You cannot delete your own account");
  }

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const existingOrder = await Order.findOne({ user: id });

  if (existingOrder) {
    res.status(400);
    throw new Error(
      "This user cannot be deleted because order records are linked to the account"
    );
  }

  const existingPayment = await Payment.findOne({ user: id });

  if (existingPayment) {
    res.status(400);
    throw new Error(
      "This user cannot be deleted because payment records are linked to the account"
    );
  }

  const userReviews = await Review.find({ user: id }).select("menuItem");
  const reviewedMenuItemIds = [
    ...new Set(userReviews.map((review) => review.menuItem.toString())),
  ];

  await Review.deleteMany({ user: id });

  for (const menuItemId of reviewedMenuItemIds) {
    await Review.calculateAverageRating(menuItemId);
  }

  if (user.profileImagePublicId) {
    await deleteImageFromCloudinary(user.profileImagePublicId);
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

module.exports = {
  createUserByAdmin,
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getUserById,
  updateUserByAdmin,
  changeUserRole,
  deleteUserByAdmin,
};