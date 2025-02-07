const express = require('express')
const { handleAuthorization, handleLogin } = require('./handlers')

function getOAuthRoutes() {
  const router = express.Router()
  router.get('/authorize', handleAuthorization)
  router.get('/token', (req, res) => {})
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
