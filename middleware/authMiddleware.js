const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const User = require("../models/User");

const protect = asyncHandler(async (req, res, next) => {
  let token;
  let decoded;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized. No token provided");
  }

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized. Invalid token");
  }

  req.user = await User.findById(decoded.id);

  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  next();
});

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized");
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error("Access denied. You do not have permission");
    }

    next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
};
