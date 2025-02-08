const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')

const { oauthRoutes, loginRoutes } = require('./routes')

const app = express()
const port = 5000

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(bodyParser.urlencoded({ extended: false }))

app.use('/oauth', oauthRoutes)
app.use('/login', loginRoutes)

app.all('*', (req, res, next) => {
  res.status(404).send('Not Found')
})

app.listen(port, () => {
  console.log(`auth-server: (http://localhost:${port})`)
})
