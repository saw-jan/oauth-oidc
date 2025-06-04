const { randomUUID: uuidv4 } = require('node:crypto')

const { validateAuthRequest, validateTokenRequest } = require('./validator')
const {
  generateCode,
  authenticateClient,
  generateAccessToken,
  parseAuthHeader,
  getTokenInfo,
} = require('./helpers')
const { userStore, sessionStore } = require('./store')

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
  const { clientId, clientSecret } = parseAuthHeader(req.get('authorization'))

  if (!authenticateClient(clientId, clientSecret)) {
    const error = {
      error: 'invalid_client',
      error_description: 'Client authentication failed',
    }
    return res.status(401).send(error)
  }

  res.status(200).send(generateAccessToken())
}

// Not defined in RFC-6749
function handleTokenInfo(req, res) {
  const params = req.body
  if (!('token' in params)) {
    return res.status(400).send("Missing 'token' parameter")
  }
  // authenticate request
  const authHeader = req.get('authorization')
  if (!authHeader || !authHeader.startsWith('Basic')) {
    res.set('WWW-Authenticate', 'Basic')
    return res.status(401).send("Missing or invalid 'Authorization' header")
  }

  const { clientId, clientSecret } = parseAuthHeader(authHeader)
  if (!authenticateClient(clientId, clientSecret)) {
    return res.status(401).send('Invalid client credentials')
  }

  // return token info
  res.set('content-type', 'application/json')
  res.status(200).send(getTokenInfo(params.token))
}

module.exports = {
  handleAuthorization,
  handleLogin,
  handleTokenRequest,
  handleTokenInfo,
}
