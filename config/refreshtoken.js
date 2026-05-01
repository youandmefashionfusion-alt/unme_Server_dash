const jwt = require("jsonwebtoken");

const generateadminRefreshToken = (id, expiresIn) => {
  const refreshTokenExpiry =
    expiresIn || process.env.JWT_REFRESH_EXPIRES_IN || "365d";
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: refreshTokenExpiry,
  });
};

module.exports = { generateadminRefreshToken };
