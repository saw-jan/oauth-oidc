const { randomUUID: uuidv4, randomBytes } = require('node:crypto')

const { getClient } = require('./clients')
const { userStore, sessionStore, codeStore, tokenStore } = require('./store')

function handleAuthorization(req, res) {
  const sessionId = uuidv4()
  const context = {}

  // validate client_id and redirect_uri
  const authError = validateAuthRequest(req)
  if (authError) {
    return res.status(400).send(authError)
  }

  context.clientId = req.query.client_id
  context.redirectUri = req.query.redirect_uri
  context.state = req.query.state || null

  // validate response_type
  const responseTypeError = validateResponseType(req)
  if (responseTypeError) {
    if (state) {
      responseTypeError.state = context.state
    }
    const errParams = new URLSearchParams(responseTypeError).toString()
    return res.status(403).redirect(`${req.query.redirect_uri}?${errParams}`)
  }

  context.responseType = req.query.response_type
  sessionStore.add(sessionId, context)

  // render login page with session_id
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
    const code = generateCode(sessionCtx.clientId, sessionCtx.redirectUri)

    let query = new URLSearchParams({ code })
    if (sessionCtx.state) query.append('state', sessionCtx.state)
    query = query.toString()

    return res.redirect(`${sessionCtx.redirectUri}?${query}`)
  }

  res.status(401).send('Invalid credentials')
}

function handleTokenRequest(req, res) {
  const params = req.body
  if (
    !params.code ||
    !params.grant_type ||
    !params.client_id ||
    !params.redirect_uri
  ) {
    return sendErrorResponse(res, { error: 'invalid_request' })
  }

  // validate grant_type
  if (params.grant_type !== 'authorization_code') {
    return sendErrorResponse(res, { error: 'unsupported_grant_type' })
  }

  // TODO: validate paramete repeatition, multiple credentials and more than one authentication method

  // check if client_id and authenticated
  const client = getClient(params.client_id)
  if (
    isConfidentialClient(client) &&
    (!params.client_secret ||
      !authenticateClient(params.client_id, params.client_secret))
  ) {
    return sendErrorResponse(res, { error: 'invalid_client', status: 401 })
  }

  // check if code is valid and not expired
  const code = codeStore.get(params.code)
  if (!code || hasCodeExpired(code.expiry)) {
    return sendErrorResponse(res, { error: 'invalid_grant' })
  }
  // check if code is for the same client_id
  if (code.clientId !== params.client_id) {
    return sendErrorResponse(res, { error: 'invalid_grant' })
  }

  // check if redirect_uri is valid
  if (
    code.redirectUri &&
    (!params.redirect_uri || code.redirectUri !== params.redirect_uri)
  ) {
    return sendErrorResponse(res, { error: 'invalid_grant' })
  }

  res.set('content-type', 'application/json')
  res.set('cache-control', 'no-store')
  res.set('pragma', 'no-cache')

  res.status(200).send(generateToken())
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

function validateResponseType(req) {
  query = req.query

  if (!('response_type' in query)) {
    return {
      error: 'invalid_request',
      error_description: 'Missing parameter: response_type',
    }
  }

  // response_type must be 'code'
  if (query.response_type !== 'code') {
    return {
      error: 'unsupported_response_type',
      error_description: `Invalid response_type: ${query.response_type}`,
    }
  }

  return null
}

function validateAuthRequest(req) {
  const requiredParams = ['client_id', 'redirect_uri']
  query = req.query

  // validate required params
  for (const param of requiredParams) {
    if (!(param in query)) {
      return `Missing parameter: '${param}'`
    }
  }

  // check if client_id is valid
  const client = getClient(query.client_id)
  if (!client) {
    return `Unknown client: ${query.client_id}`
  }

  // validate redirect_uri
  // TODO: check if redirect_uri is a valid URL
  if (!client.redirect_uris.includes(query.redirect_uri)) {
    return `Invalid redirect_uri: ${query.redirect_uri}`
  }

  return null
}

function generateCode(clientId, redirectUri) {
  // 32 length random hex string
  const code = randomBytes(16).toString('hex')
  const expiry = Date.now() + 10 * 60 * 1000 // 10 minutes
  codeStore.add(code, { clientId, redirectUri, expiresAt: expiry, used: false })
  return code
}

function generateToken(clientId) {
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

function hasCodeExpired(codeExpiry) {
  const now = Date.now()
  if (now > codeExpiry) {
    return true
  }
  return false
}

function isConfidentialClient(client) {
  return !!client.client_secret
}

function authenticateClient(clientId, clientSecret) {
  const client = getClient(clientId)
  return client.client_secret === clientSecret
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
