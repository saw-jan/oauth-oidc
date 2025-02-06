const express = require('express')
const { oauthRoutes, loginRoutes } = require('./routes')

const app = express()
const port = 5000

app.use('/oauth', oauthRoutes)
app.use('/login', loginRoutes)

app.all('*', (req, res, next) => {
  res.status(404).send('Not Found')
})

app.listen(port, () => {
  console.log(`auth-server: (http://localhost:${port})`)
})
