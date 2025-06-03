const { randomBytes } = require('node:crypto')
const { getClient } = require('./clients')
const { codeStore, tokenStore } = require('./store')

function generateCode(clientId, redirectUri) {
  // 32 length random hex string
  const code = randomBytes(16).toString('hex')
  const expiry = Date.now() + 10 * 60 * 1000 // 10 minutes
  codeStore.add(code, { clientId, redirectUri, expiresAt: expiry, used: false })
  return code
}

function hasCodeExpired(codeExpiry) {
  const now = Date.now()
  if (now > codeExpiry) {
    return true
  }
  return false
}

function authenticateClient(clientId, clientSecret) {
  const client = getClient(clientId)
  return client.client_secret === clientSecret
}

function generateAccessToken(clientId) {
  const accessToken = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+/g, '')
  const token = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600, // 1 hour (in seconds)
  }
  tokenStore.add(accessToken, { ...token, clientId, createdAt: Date.now() })
  return token
}

module.exports = {
  generateCode,
  hasCodeExpired,
  authenticateClient,
  generateAccessToken,
}
