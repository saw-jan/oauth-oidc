# OAuth (2.x)

- Authorization Protocol
- Allow actions on behalf of user

## Roles

1. Resource Owner:
   - User
   - Grants permission to the Client to access resources
2. Client
   - Application
   - Performs actions on behalf of user
   - Needs valid Access Token
   - Needs to be registered with Authorization Server
3. Authorization Server
   - Creation of new Client
   - Receives authorization request from Client
   - Requests user to authenticate and consent
   - Issues access tokens to Client
   - Exposes two endpoints:
     - **Authorization** endpoint: handles user authentication and consent (user-to-machine)
     - **Token** endpoint: handles token exchange (machine-to-machine)
4. Resource Server
   - Server hosting resources
   - Accepts and validates Access Token from Client
   - Provides resources to Client

## Scopes

- Set of permissions
- Implementation depends on the Resource Server
- no predefined scopes

## Grant Types (Flows)

- Set of rules (steps) a Client has to perform to get access tokens

1. Authorization Code
2. Authorization Code with PKCE
   - added and required in 2.1
3. Client Credentials
4. Resource Owner Password Credentials
   - Removed in 2.1
5. Implicit
   - Removed in 2.1

## Tokens

1. Access Token
   - short-lived
   - used to access resources
2. Refresh TOke
   - long-lived
   - used to get new Access Token
