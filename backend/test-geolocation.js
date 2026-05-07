// Test script to verify IP geolocation functionality
// Run with: node test-geolocation.js

const { getLocationFromIP, isUserInCity } = require('./utils/geoLocation');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║              IP Geolocation Test Suite                         ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Test 1: Test with a Hyderabad IP (Jio/Airtel India)
console.log('Test 1: Checking location for Hyderabad IP (103.97.71.97)');
const hyderabadIP = '103.97.71.97';
const hyderabadLocation = getLocationFromIP(hyderabadIP);
console.log('Location:', hyderabadLocation);
console.log('Is Hyderabad:', isUserInCity(hyderabadIP, 'Hyderabad'));
console.log('');

// Test 2: Test with another IP
console.log('Test 2: Checking location for Mumbai IP (49.44.82.101)');
const mumbaiIP = '49.44.82.101';
const mumbaiLocation = getLocationFromIP(mumbaiIP);
console.log('Location:', mumbaiLocation);
console.log('Is Hyderabad:', isUserInCity(mumbaiIP, 'Hyderabad'));
console.log('');

// Test 3: Test with localhost (should return null)
console.log('Test 3: Checking location for localhost (127.0.0.1)');
const localhostLocation = getLocationFromIP('127.0.0.1');
console.log('Location:', localhostLocation);
console.log('Is Hyderabad:', isUserInCity('127.0.0.1', 'Hyderabad'));
console.log('');

// Test 4: Test with empty IP
console.log('Test 4: Checking location for empty IP');
const emptyLocation = getLocationFromIP('');
console.log('Location:', emptyLocation);
console.log('');

console.log('═══════════════════════════════════════════════════════════════\n');
