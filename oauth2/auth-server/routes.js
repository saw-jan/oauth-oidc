const express = require('express')
const { handleAuthorization, handleLogin } = require('./handlers')

function getOAuthRoutes() {
  const router = express.Router()
  router.get('/authorize', handleAuthorization)
  router.post('/token', (req, res) => {
    res.send({ access_token: 'access_token' })
  })
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
