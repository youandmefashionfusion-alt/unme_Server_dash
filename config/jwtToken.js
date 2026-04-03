const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || "365d";
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: accessTokenExpiry });
};

module.exports = { generateToken };
