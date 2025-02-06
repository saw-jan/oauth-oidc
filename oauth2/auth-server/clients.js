module.exports = {
  web: {
    client_id: 'web',
    redirect_uris: ['http://localhost:3000/oauth-callback'],
  },
}

// http://localhost:5000/oauth/authorize?response_type=code&client_id=web&redirect_uri=http://localhost:3000/oauth-callback
