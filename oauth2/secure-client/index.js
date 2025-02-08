const { randomBytes } = require('node:crypto')
const express = require('express')
const session = require('express-session')
const path = require('path')
const request = require('axios')

const app = express()
const port = 3443

const oauthClient = {
  client_id: 'secure-client',
  client_secret: 'MDQ4Y2I3MzA5OWUzOWMzZTIyNzk4MDNi',
  redirect_uri: 'http://localhost:3443/oauth-callback',
}

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(
  session({
    secret: 'very_secret',
    resave: false,
    saveUninitialized: true,
  })
)

app.get('/', (req, res) => {
  const state = generateState()
  req.session.state = state

  const query = new URLSearchParams({
    response_type: 'code',
    client_id: oauthClient.client_id,
    redirect_uri: oauthClient.redirect_uri,
    state,
  }).toString()

  res.redirect('http://localhost:5000/oauth/authorize?' + query)
})

app.get('/oauth-callback', async (req, res) => {
  if (req.session.state !== req.query.state) {
    return res.status(403).send('Invalid state!')
  }
  const code = req.query.code
  req.session.state = null

  const data = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: oauthClient.redirect_uri,
    client_id: oauthClient.client_id,
    client_secret: oauthClient.client_secret,
  })

  // exchange code for token
  const tokenRes = await request.post('http://localhost:5000/oauth/token', data)

  if (tokenRes.status !== 200) {
    return res.status(tokenRes.status).send(tokenRes.statusText)
  }

  console.log(tokenRes.data)
})

app.all('*', (req, res) => {
  res.status(404).send('Not Found')
})

app.listen(port, () => {
  console.log(`secure-client: (http://localhost:${port})`)
})

function generateState() {
  return randomBytes(16).toString('hex')
}
