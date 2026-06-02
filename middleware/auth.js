const jwt = require("jsonwebtoken");
const User = require("../Models/userModel");

/**
 * 🔐 Protect routes (JWT authentication)
 * Adds logged-in user to req.user
 */
exports.protect = async (req, res, next) => {
  let token;

  // Check Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // No token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("[AUTH][USER] decoded token:", {
      id: decoded.id,
      type: decoded.type || "user",
    });

    if (decoded.type && decoded.type !== "user") {
      return res.status(403).json({
        success: false,
        message: "User access only",
      });
    }

    // Attach user to request
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    console.log("[AUTH][USER] req.user:", {
      id: String(req.user._id),
      email: req.user.email,
      role: req.user.role,
    });

    next();
  } catch (error) {
    console.error("[AUTH][USER] token failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};

/**
 * 🔒 Role-based authorization
 * Usage: authorize('admin', 'editor')
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};
