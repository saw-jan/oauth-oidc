const express = require('express')

const app = express()
const port = 5001

app.all('*', (req, res, next) => {
  res.status(404).send('Not Found')
})

app.listen(port, () => {
  console.log(`resource-server: (http://localhost:${port})`)
})
