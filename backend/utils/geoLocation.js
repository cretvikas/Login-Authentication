// utils/geoLocation.js

const geoip = require('geoip-lite');

/**
 * Get city information from IP address
 * Uses geoip-lite as primary source
 * @param {string} ipAddress - User's IP address
 * @returns {object} - { city: string, country: string, latitude: number, longitude: number, timezone: string }
 */
function getLocationFromIP(ipAddress) {
  try {
    if (!ipAddress) {
      return { city: null, country: null, latitude: null, longitude: null, timezone: null };
    }

    // Lookup the IP using geoip-lite
    const geo = geoip.lookup(ipAddress);

    if (!geo) {
      console.log(`[GeoLocation] No geolocation data found for IP: ${ipAddress}`);
      return { city: null, country: null, latitude: null, longitude: null, timezone: null };
    }

    return {
      city: geo.city || null,
      country: geo.country || null,
      latitude: geo.ll ? geo.ll[0] : null,
      longitude: geo.ll ? geo.ll[1] : null,
      timezone: geo.timezone || null,
    };
  } catch (err) {
    console.error('[GeoLocation] Error getting location from IP:', err.message);
    return { city: null, country: null, latitude: null, longitude: null, timezone: null };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in kilometers
 */
function getDistanceBetweenCoordinates(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

/**
 * Check if user is in a specific city using coordinate-based detection
 * Useful for Indian cities where geoip-lite doesn't provide city names
 * @param {string} ipAddress - User's IP address
 * @param {string} targetCity - City name to check (e.g., 'Hyderabad')
 * @param {number} radiusKm - Radius in kilometers (default: 50km)
 * @returns {boolean} - True if user is within the city radius
 */
function isUserInCity(ipAddress, targetCity = 'Hyderabad', radiusKm = 50) {
  try {
    const location = getLocationFromIP(ipAddress);
    
    if (!location.latitude || !location.longitude) {
      console.log(`[GeoLocation] No coordinates found for IP: ${ipAddress}`);
      return false;
    }

    // City coordinates and approximate radius
    const cities = {
      'Hyderabad': { lat: 17.3850, lon: 78.4867, defaultRadius: 40 },
      'Mumbai': { lat: 19.0760, lon: 72.8777, defaultRadius: 50 },
      'Delhi': { lat: 28.7041, lon: 77.1025, defaultRadius: 50 },
      'Bangalore': { lat: 12.9716, lon: 77.5946, defaultRadius: 45 },
      'Chennai': { lat: 13.0827, lon: 80.2707, defaultRadius: 40 },
      'Pune': { lat: 18.5204, lon: 73.8567, defaultRadius: 40 },
      'Kolkata': { lat: 22.5726, lon: 88.3639, defaultRadius: 40 },
      'Ahmedabad': { lat: 23.0225, lon: 72.5714, defaultRadius: 40 },
    };

    const target = cities[targetCity];
    if (!target) {
      console.log(`[GeoLocation] City '${targetCity}' not configured in database`);
      return false;
    }

    // Use provided radius or default for the city
    const checkRadius = radiusKm || target.defaultRadius;

    // Calculate distance from IP location to city center
    const distance = getDistanceBetweenCoordinates(
      location.latitude,
      location.longitude,
      target.lat,
      target.lon
    );

    const isInCity = distance <= checkRadius;
    
    if (isInCity) {
      console.log(`[GeoLocation] User IP ${ipAddress} is within ${distance.toFixed(2)}km of ${targetCity} center`);
    } else {
      console.log(`[GeoLocation] User IP ${ipAddress} is ${distance.toFixed(2)}km away from ${targetCity} center (threshold: ${checkRadius}km)`);
    }
    
    return isInCity;
  } catch (err) {
    console.error('[GeoLocation] Error checking city:', err.message);
    return false;
  }
}

module.exports = {
  getLocationFromIP,
  isUserInCity,
  getDistanceBetweenCoordinates,
};
