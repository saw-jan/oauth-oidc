const express = require('express')
const routes = require('./routes')

const app = express()
const port = 5000

app.use('/oauth', routes)
app.all('*', (req, res, next) => {
  res.status(404).send('Not Found')
})

app.listen(port, () => {
  console.log(`auth-server (:${port})`)
})
