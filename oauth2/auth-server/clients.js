const clients = {
  web: {
    client_id: 'web',
    redirect_uris: ['http://localhost:3000/oauth-callback'],
    type: 'public',
  },
  'secure-client': {
    client_id: 'secure-client',
    client_secret: 'MDQ4Y2I3MzA5OWUzOWMzZTIyNzk4MDNi',
    redirect_uris: ['http://localhost:3443/oauth-callback'],
    type: 'confidential',
  },
}

function getClient(clientId) {
  for (const client in clients) {
    if (clients[client].client_id === clientId) return clients[client]
  }
  return null
}

module.exports = { getClient }
