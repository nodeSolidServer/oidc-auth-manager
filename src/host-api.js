'use strict'

const url = require('url')

const LogoutRequest = require('./handlers/logout-request')
const LoginConsentRequest = require('./handlers/login-consent-request')

// This gets called from OIDC Provider's /authorize endpoint
function authenticate (authRequest) {
  console.log('In authenticate()')
  let debug = authRequest.host.debug || console.log.bind(console)

  let session = authRequest.req.session
  debug('AUTHENTICATE injected method')

  if (session.identified && session.userId) {
    debug('User webId found in session: ', session.userId)

    authRequest.subject = {
      _id: session.userId  // put webId into the IDToken's subject claim
    }
  } else {
    // User not authenticated, send them to login
    debug('User not authenticated, sending to /login')

    let loginUrl = url.parse('/login')
    loginUrl.query = authRequest.req.query
    loginUrl = url.format(loginUrl)
    authRequest.subject = null
    authRequest.res.redirect(loginUrl)
  }
  return authRequest
}

function obtainConsent (authRequest) {
  let debug = authRequest.host.debug || console.log.bind(console)
  let skipConsent = true

  return LoginConsentRequest.handle(authRequest, skipConsent)
    .catch(error => {
      debug('Error in auth Consent step: ', error)
    })
}

function logout (logoutRequest) {
  return LogoutRequest.handle(logoutRequest.req, logoutRequest.res)
    .then(() => logoutRequest)
}

module.exports = {
  authenticate,
  obtainConsent,
  logout
}
