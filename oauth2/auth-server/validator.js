const { getClient } = require('./clients')
const { codeStore } = require('./store')
const { hasCodeExpired } = require('./helpers')

function sendAuthorizeError(res, query, error, errorMessage) {
  const responseTypeError = {
    error,
    error_description: errorMessage,
  }
  // if state is provided, include it in the error response
  if (query.state) {
    responseTypeError.state = query.state
  }
  const errParams = new URLSearchParams(responseTypeError).toString()
  return res.status(400).redirect(`${query.redirect_uri}?${errParams}`)
}

// [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-3.1
// [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1
function validateAuthRequest(req, res) {
  const requiredParams = ['client_id', 'redirect_uri', 'response_type']
  const optionalParams = ['scope', 'state']
  query = req.query

  // ---------------------------------------
  // validate client_id and redirect_uri
  // and send error to the resource owner
  // ---------------------------------------

  // 1. check required parameters are present
  for (const param of requiredParams) {
    if (param !== 'response_type' && !(param in query)) {
      return res.status(400).send(`Missing parameter: '${param}'`)
    }
  }

  // 2. check if client_id is valid
  const client = getClient(query.client_id)
  if (!client) {
    return res.status(400).send(`Unknown client: ${query.client_id}`)
  }

  // 3. check if redirect_uri is valid for the client
  if (!client.redirect_uris.includes(query.redirect_uri)) {
    return res.status(400).send(`Invalid redirect_uri: ${query.redirect_uri}`)
  }

  // ---------------------------------------
  // send error to the client via redirect
  // ---------------------------------------

  const state = query.state || null

  // 4. check if response_type is provided
  if (!('response_type' in query)) {
    const errorMessage = 'Missing parameter: response_type'
    return sendAuthorizeError(res, query, 'invalid_request', errorMessage)
  }

  // 5. check duplicate parameters
  const recognizedParams = [...requiredParams, ...optionalParams]
  const filteredParams = Object.keys(query).filter((param) =>
    recognizedParams.includes(param)
  )
  const uniqueParams = new Set(filteredParams)
  if (filteredParams.length !== uniqueParams.size) {
    const errorMessage = 'Duplicate parameters are not allowed'
    return sendAuthorizeError(res, query, 'invalid_request', errorMessage)
  }

  // 6. check if response_type is not supported
  if (!['code', 'token'].includes(query.response_type)) {
    errorMessage = `Unsupported grant type: ${query.response_type}`
    return sendAuthorizeError(
      res,
      query,
      'unsupported_grant_type',
      errorMessage
    )
  }
  // 7. check if response_type is valid for the provided client type
  if (
    // 7.1 public client requires token response_type
    // [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.1
    (client.type === 'public' && query.response_type !== 'token') ||
    // 7.2 confidential client requires code response_type
    // [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.1
    (client.type === 'confidential' && query.response_type !== 'code')
  ) {
    errorMessage = `Invalid response_type: ${query.response_type}`
    return sendAuthorizeError(res, query, 'unauthorized_client', errorMessage)
  }
}

// [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-3.2
// [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
// [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
function validateTokenRequest(req, res) {
  const requiredParams = ['grant_type', 'code', 'client_id', 'redirect_uri']
  const params = req.body

  // 1. check authorization method
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    const error = {
      error: 'invalid_client',
      error_description: 'Missing or invalid authorization header',
    }
    res.set('WWW-Authenticate', 'Basic')
    return res.status(401).send(error)
  }
  // 2. check required parameters are present
  for (const param of requiredParams) {
    if (!(param in params)) {
      const error = {
        error: 'invalid_request',
        error_description: `Missing parameter: ${param}`,
      }
      return res.status(400).send(error)
    }
  }

  // 3. check duplicate parameters
  const filteredParams = Object.keys(params).filter((param) =>
    requiredParams.includes(param)
  )
  const uniqueParams = new Set(filteredParams)
  if (filteredParams.length !== uniqueParams.size) {
    const error = {
      error: 'invalid_request',
      error_description: 'Duplicate parameters are not allowed',
    }
    return res.status(400).send(error)
  }

  const clientCredentials = Buffer.from(
    authHeader.split(' ')[1],
    'base64'
  ).toString('utf-8')
  const [clientId] = clientCredentials
    .split(':')
    // [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1
    .map((item) => decodeURIComponent(item.replace(/\+/g, ' ')))
  // 4. check if client to authenticate and client_id match
  if (clientId !== params.client_id) {
    const error = {
      error: 'invalid_client',
      error_description: 'Client mismatch',
    }
    return res.status(401).send(error)
  }

  // 5. check if multiple credentials are provided
  if (params.client_secret) {
    const error = {
      error: 'invalid_client',
      error_description: 'Multiple credentials are not allowed',
    }
    return res.status(400).send(error)
  }

  // 6. validate grant_type
  if (params.grant_type !== 'authorization_code') {
    const error = {
      error: 'unsupported_grant_type',
      error_description: `Unsupported grant type: ${param}`,
    }
    return res.status(400).send(error)
  }

  const code = codeStore.get(params.code)
  // 7. check if code is for the client_id
  if (!code || code.clientId !== clientId) {
    const error = {
      error: 'invalid_grant',
      error_description: 'Invalid authorization code',
    }
    return res.status(400).send(error)
  }

  // 8. check if code has expired
  if (hasCodeExpired(code.expiry)) {
    const error = {
      error: 'invalid_grant',
      error_description: 'Authorization code has expired',
    }
    return res.status(400).send(error)
  }

  // 9. check if redirect_uri is valid
  if (
    code.redirectUri &&
    (!params.redirect_uri || code.redirectUri !== params.redirect_uri)
  ) {
    const error = {
      error: 'invalid_grant',
      error_description: 'Mismatched redirect_uri',
    }
    return res.status(400).send(error)
  }
}

module.exports = {
  validateAuthRequest,
  validateTokenRequest,
}
