const express = require('express')
const {
  handleAuthorization,
  handleLogin,
  handleTokenRequest,
} = require('./handlers')

function getOAuthRoutes() {
  const router = express.Router()
  router.get('/authorize', handleAuthorization)
  router.post('/token', handleTokenRequest)
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
