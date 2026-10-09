const jwt = require("jsonwebtoken");

// Sign-in sessions last SESSION_TTL (default 1 hour). The frontend asks the
// user whether they are still there shortly before expiry and, if so, calls
// the refresh endpoint to get a new token.
const SESSION_TTL = process.env.SESSION_TTL || "1h";

const signSessionToken = (id, type) =>
  jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: SESSION_TTL,
    algorithm: "HS256",
  });

module.exports = { SESSION_TTL, signSessionToken };
