const { randomUUID: uuidv4, randomBytes } = require('node:crypto')

const clients = require('./clients')
const { users, sessions, codes } = require('./store')

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

function getClient(clientId) {
  for (const client in clients) {
    if (clients[client].client_id === clientId) return clients[client]
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

module.exports = { handleAuthorization, handleLogin }
