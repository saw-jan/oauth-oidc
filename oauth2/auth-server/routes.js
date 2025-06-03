const express = require('express')
const {
  handleAuthorization,
  handleLogin,
  handleTokenRequest,
  handleTokenInfo,
} = require('./handlers')

function getOAuthRoutes() {
  const router = express.Router()
  // [RFC-6749] https://datatracker.ietf.org/doc/html/rfc6749#section-3.1
  router.get('/authorize', handleAuthorization)
  router.post('/token', handleTokenRequest)
  router.post('/introspect', handleTokenInfo)
  return router
}

function getLoginRoutes() {
  const router = express.Router()
  router.post('/authenticate', handleLogin)
  return router
}

module.exports = {
  oauthRoutes: getOAuthRoutes(),
  loginRoutes: getLoginRoutes(),
}
