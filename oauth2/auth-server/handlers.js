const { randomUUID: uuidv4 } = require('node:crypto')

const { validateAuthRequest, validateTokenRequest } = require('./validator')
const {
  generateCode,
  authenticateClient,
  generateAccessToken,
} = require('./helpers')
const { userStore, sessionStore, tokenStore } = require('./store')

function handleAuthorization(req, res) {
  const sessionId = uuidv4()
  const context = {}

  // 1(authorize). validate request
  if (validateAuthRequest(req, res) !== true) {
    return
  }

  context.clientId = req.query.client_id
  context.redirectUri = req.query.redirect_uri
  context.state = req.query.state || null
  context.responseType = req.query.response_type
  sessionStore.add(sessionId, context)

  // 2(authorize). authenticate resource owner
  res.render('login', { query: `session_id=${sessionId}` })
}

function handleLogin(req, res) {
  const sessionCtx = sessionStore.get(req.query.session_id)
  if (!sessionCtx) {
    return res.status(400).send('Invalid request')
  }

  const user = userStore.getUser(req.body.username)
  if (
    user.username === req.body.username &&
    user.password === req.body.password
  ) {
    // [RCF-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2
    const code = generateCode(sessionCtx.clientId, sessionCtx.redirectUri)
    let query = new URLSearchParams({ code })
    if (sessionCtx.state) query.append('state', sessionCtx.state)
    query = query.toString()
    // 3(authorize). redirect to the client with the authorization code
    return res.redirect(`${sessionCtx.redirectUri}?${query}`)
  }

  res.status(401).send('Invalid credentials')
}

function handleTokenRequest(req, res) {
  // [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
  res.set('content-type', 'application/json')
  res.set('cache-control', 'no-store')
  res.set('pragma', 'no-cache')

  if (validateTokenRequest(req, res) !== true) {
    return
  }

  // authenticate client
  const authHeader = req.get('authorization')
  const [clientId, clientSecret] = Buffer.from(
    authHeader.split(' ')[1],
    'base64'
  )
    .toString()
    .split(':')
    .map((item) => decodeURIComponent(item.replace(/\+/g, ' ')))

  if (!authenticateClient(clientId, clientSecret)) {
    const error = {
      error: 'invalid_client',
      error_description: 'Client authentication failed',
    }
    return res.status(401).send(error)
  }

  res.status(200).send(generateAccessToken())
}

function handleTokenInfo(req, res) {
  const params = req.body
  if (!('token' in params)) {
    return sendErrorResponse(res, { error: 'invalid_request' })
  }
  // authenticate request
  const authHeader = req.get('authorization')
  if (!authHeader.startsWith('Basic')) {
    res.set('WWW-Authenticate', 'Basic')
    return sendErrorResponse(res, { error: 'invalid_client' })
  }
  if (authHeader && !authenticateSystemClient(authHeader)) {
    return sendErrorResponse(res, { error: 'invalid_client' })
  }

  // return token info
  res.set('content-type', 'application/json')
  res.status(200).send(getTokenInfo(params.token))
}

/**
 * -------------------------------
 * Helper functions
 * -------------------------------
 */
function sendErrorResponse(res, { error, description = null, status = 400 }) {
  const errorResponse = { error }
  if (description) errorResponse.error_description = description
  res.status(status).send(errorResponse)
}

function authenticateSystemClient(authHeader) {
  const [clientId, clientSecret] = Buffer.from(
    authHeader.split(' ')[1],
    'base64'
  )
    .toString()
    .split(':')
  return clientId === 'system-client' && clientSecret === 'top_secret_key'
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
  handleAuthorization,
  handleLogin,
  handleTokenRequest,
  handleTokenInfo,
}
