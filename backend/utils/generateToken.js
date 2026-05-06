// utils/generateTokens.js

const jwt = require('jsonwebtoken');

function generateTokens(user) {

  const accessToken = jwt.sign(
    {
      userId: user.userId,
      email:  user.email,
      roles:  user.roles,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }        // short lived
  );

  const refreshToken = jwt.sign(
    { userId: user.userId },    // minimal payload
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }         // long lived
  );

  return { accessToken, refreshToken };
}

module.exports = generateTokens;