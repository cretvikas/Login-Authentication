// utils/vault.js
const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN
});

async function loadSecrets() {
  if (!process.env.VAULT_TOKEN) {
    console.warn('⚠️ VAULT_TOKEN not provided, skipping Vault integration and falling back to local config.env.');
    return;
  }

  try {
    console.log('🔒 Fetching secrets from HashiCorp Vault ("secret/data/authenticator")...');
    
    // In Vault KV Version 2, secrets are located at 'secret/data/<path>'
    const result = await vault.read('secret/data/authenticator');
    const secrets = result.data.data;

    if (secrets) {
      // Inject the secrets directly into process.env
      for (const [key, value] of Object.entries(secrets)) {
        process.env[key] = value;
      }
      console.log('✅ Secrets successfully loaded and injected into environment.');
    } else {
      console.warn('⚠️ No secrets found at "secret/data/authenticator" in Vault.');
    }
  } catch (err) {
    console.error('❌ Error fetching secrets from Vault:', err.message);
    if (err.response && err.response.statusCode === 403) {
       console.error('   Verify that your VAULT_TOKEN is correct and has read permissions.');
    }
    // We throw the error so the server intentionally fails to start if Vault is down
    throw err;
  }
}

module.exports = { loadSecrets };
