// utils/ipValidator.js

const ip = require('ip');

/**
 * Check if an IP address falls within allowed CIDR ranges
 * @param {string} userIp - The user's IP address
 * @param {string[]} allowedRanges - Array of CIDR ranges (e.g., ['192.0.2.0/24'])
 * @returns {boolean} - True if IP is in allowed range, false otherwise
 */
function isIpInAllowedRange(userIp, allowedRanges) {
  if (!userIp || !allowedRanges || allowedRanges.length === 0) {
    return false;
  }

  try {
    // Try each allowed range
    for (const range of allowedRanges) {
      try {
        if (ip.cidrSubnet(range).contains(userIp)) {
          return true;
        }
      } catch (err) {
        console.error(`Invalid CIDR range: ${range}`, err.message);
        continue;
      }
    }
    return false;
  } catch (err) {
    console.error('Error checking IP range:', err.message);
    return false;
  }
}

/**
 * Validate user login based on role and IP address
 * If user is NOT an end_user, their IP must be in the allowed ranges
 * @param {string} userRole - User's role from database
 * @param {string} userIp - User's IP address
 * @param {string[]} allowedRanges - Array of CIDR ranges
 * @returns {object} - { allowed: boolean, reason: string }
 */
function validateUserLogin(userRole, userIp, allowedRanges) {
  // end_user role doesn't need IP restriction
  if (userRole && userRole.includes('end_user')) {
    return { allowed: true, reason: 'end_user role - no IP restriction' };
  }

  // Non-end_user roles require IP validation
  if (!isIpInAllowedRange(userIp, allowedRanges)) {
    return {
      allowed: false,
      reason: 'User role requires whitelisted IP address',
    };
  }

  return { allowed: true, reason: 'Non-end_user with valid IP address' };
}

module.exports = {
  isIpInAllowedRange,
  validateUserLogin,
};
