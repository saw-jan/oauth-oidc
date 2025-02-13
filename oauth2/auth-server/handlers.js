const { randomUUID: uuidv4, randomBytes } = require('node:crypto')

const { getClient } = require('./clients')
const { users, sessions, codes, tokens } = require('./store')

function handleAuthorization(req, res) {
  const sessionId = uuidv4()
  const context = {}

  // validate client_id and redirect_uri
  const authError = validateAuthRequest(req)
  if (authError) {
    res.status(400).send(authError)
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
    res.status(403).redirect(`${req.query.redirect_uri}?${errParams}`)
  }

  context.responseType = req.query.response_type
  sessions[sessionId] = context

  // render login page with session_id
  res.render('login', { query: `session_id=${sessionId}` })
}

function handleLogin(req, res) {
  if (!req.query.session_id || !sessions[req.query.session_id]) {
    return res.status(400).send('Invalid request')
  }

  for (const user of users) {
    if (
      user.username === req.body.username &&
      user.password === req.body.password
    ) {
      const ctx = sessions[req.query.session_id]
      const code = generateCode(ctx.clientId, ctx.redirectUri)

      let query = new URLSearchParams({ code })
      if (ctx.state) query.append('state', ctx.state)
      query = query.toString()

      return res.redirect(`${ctx.redirectUri}?${query}`)
    }
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
    sendErrorResponse(res, 'invalid_request')
  }

  // validate grant_type
  if (params.grant_type !== 'authorization_code') {
    sendErrorResponse(res, 'unsupported_grant_type')
  }

  const client = getClient(params.client_id)
  if (!client) {
    sendErrorResponse(res, 'invalid_client')
  }
  // check if client_id and client_secret are valid
  if (
    isConfidentialClient(client) &&
    (!params.client_secret ||
      !authenticateClient(params.client_id, params.client_secret))
  ) {
    res.status(401).send('invalid_client')
  }

  // check if code is valid and not expired
  const code = codes[params.code]
  if (!code || hasCodeExpired(code.expiry)) {
    sendErrorResponse(res, 'invalid_grant')
  }
  // check if code is for the same client_id
  if (code.clientId !== params.client_id) {
    sendErrorResponse(res, 'invalid_grant')
  }

  // check if redirect_uri is valid
  if (
    code.redirectUri &&
    (!params.redirect_uri || code.redirectUri !== params.redirect_uri)
  ) {
    sendErrorResponse(res, 'invalid_grant')
  }

  res.set('content-type', 'application/json')
  res.set('cache-control', 'no-store')
  res.set('pragma', 'no-cache')

  res.status(200).send(generateToken())
}

function handleTokenInfo(req, res) {
  const params = req.body
  if (!params.token) {
    sendErrorResponse(res, 'invalid_request')
  }
  // authenticate request
  const authHeader = req.get('authorization')
  if (authHeader && !authenticateSystemClient(authHeader)) {
    sendErrorResponse(res, 'invalid_client')
  }

  // return token info
  res.set('content-type', 'application/json')
}

/**
 * -------------------------------
 * Helper functions
 * -------------------------------
 */
function sendErrorResponse(res, error, description = '') {
  const errorResponse = { error }
  if (description) errorResponse.error_description = description
  res.status(400).send(errorResponse)
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
  codes[code] = { clientId, redirectUri, expiresAt: expiry, used: false }
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
  tokens[accessToken] = { ...token, clientId }
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
module.exports = {
  handleAuthorization,
  handleLogin,
  handleTokenRequest,
  handleTokenInfo,
}
