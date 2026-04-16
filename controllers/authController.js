const asyncHandler = require("express-async-handler");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const sanitizeUser = require("../utils/sanitizeUser");

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    res.status(400);
    throw new Error("User already exists with this email");
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    phone,
    address,
  });

  const token = generateToken(user._id, user.role);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    user: sanitizeUser(user),
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user._id, user.role);

  res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: sanitizeUser(user),
  });
});

const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

const adminOnlyExample = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome Admin. This route is protected by role middleware.",
  });
});

module.exports = {
  registerUser,
  loginUser,
  getMyProfile,
  adminOnlyExample,
};
