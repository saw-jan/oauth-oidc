const express = require('express')
const request = require('axios')

const app = express()
const port = 5001

async function verifyToken(req, res, next) {
  const token = '' // TODO: get token from request
  const clientAuthToken = Buffer.from('system-client:top_secret_key').toString(
    'base64'
  )

  const response = await request.post(
    'http://localhost:5000/oauth/introspect',
    { token },
    { headers: { Authorization: `Basic ${clientAuthToken}` } }
  )

  if (response.status !== 200 || !response.data.active) {
    res.status(401).send('Unauthorized')
  }

  next()
}

app.get('/api/files', verifyToken, (req, res) => {
  res.json([
    { id: 1, name: 'epsum.txt' },
    { id: 2, name: 'lorem.txt' },
  ])
})

app.all('*', (req, res, next) => {
  res.status(404).send('Not Found')
})

app.listen(port, () => {
  console.log(`resource-server: (http://localhost:${port})`)
})
