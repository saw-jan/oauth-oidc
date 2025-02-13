const users = [
  { username: 'admin', password: 'admin' },
  { username: 'demo', password: '1234' },
]
const userStore = {
  getUser: (username) => {
    return users.find((u) => u.username === username)
  },
}

const codes = {}
const codeStore = {
  get: (code) => codes[code],
  add: (key, codeInfo) => (codes[key] = codeInfo),
}

const tokens = {}
const tokenStore = {
  get: (token) => tokens[token],
  add: (key, tokenInfo) => (tokens[key] = tokenInfo),
  getTokenInfo: (token) => {
    const tokenObj = tokens[token]
    const tokenInfo = {}
    if (!tokenObj) {
      tokenInfo.active = false
      return tokenInfo
    }
  },
}

const sessions = {}
const sessionStore = {
  get: (session) => sessions[session],
  add: (key, sessionInfo) => (sessions[key] = sessionInfo),
}

module.exports = {
  userStore,
  codeStore,
  tokenStore,
  sessionStore,
}
