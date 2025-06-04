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

function parseAuthHeader(authHeader) {
  const [clientId, clientSecret] = Buffer.from(
    authHeader.split(' ')[1],
    'base64'
  )
    .toString()
    .split(':')
    .map((item) => decodeURIComponent(item.replace(/\+/g, ' ')))
  return { clientId, clientSecret }
}

function getTokenInfo(token) {
  const tokenObj = tokenStore.get(token)
  const tokenInfo = { active: false }
  if (!tokenObj) {
    return tokenInfo
  }

  // check if token has expired
  const timeDiffSeconds = (Date.now() - tokenObj.createdAt) / 1000
  if (timeDiffSeconds >= tokenObj.expires_in) {
    return tokenInfo
  }

  tokenInfo.active = true
  tokenInfo.client_id = tokenObj.clientId
  tokenInfo.exp = tokenObj.createdAt + tokenObj.expires_in * 1000
  tokenInfo.iat = tokenObj.createdAt

  return tokenInfo
}

module.exports = {
  generateCode,
  hasCodeExpired,
  authenticateClient,
  generateAccessToken,
  parseAuthHeader,
  getTokenInfo,
}
