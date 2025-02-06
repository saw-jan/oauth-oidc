const clients = require('./clients')
const path = require('path')

function handleAuthorization(req, res) {
  // validate client_id and redirect_uri
  const authError = validateAuthRequest(req)
  if (authError) {
    res.status(400).send(authError)
  }

  const state = req.query.state || null

  // validate response_type
  const responseTypeError = validateResponseType(req)
  if (responseTypeError) {
    if (state) {
      responseTypeError.state = state
    }
    const errParams = new URLSearchParams(responseTypeError).toString()
    res.status(403).redirect(`${req.query.redirect_uri}?${errParams}`)
  }

  return res.sendFile(path.join(__dirname, 'static', 'login.html'))
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

module.exports = { handleAuthorization }
