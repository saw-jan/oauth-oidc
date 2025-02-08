module.exports = {
  web: {
    client_id: 'web',
    redirect_uris: ['http://localhost:3000/oauth-callback'],
  },
  'secure-client': {
    client_id: 'secure-client',
    client_secret: 'MDQ4Y2I3MzA5OWUzOWMzZTIyNzk4MDNi',
    redirect_uris: ['http://localhost:3443/oauth-callback'],
  },
}

// http://localhost:5000/oauth/authorize?response_type=code&client_id=web&redirect_uri=http://localhost:3000/oauth-callback
