const path = require('path')
const { v4: uuidv4 } = require('uuid')

const clients = require('./clients')
const { users, reqContext } = require('./store')

function handleAuthorization(req, res) {
  const reqId = uuidv4()
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
  reqContext[reqId] = context

  // implement templating
  // send reqId to login page
  return res.sendFile(path.join(__dirname, 'static', 'login.html'))
}

function handleLogin(req, res) {
  for (const user of users) {
    if (
      user.username === req.body.username &&
      user.password === req.body.password
    ) {
      // TODO: generate code
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

module.exports = { handleAuthorization, handleLogin }
