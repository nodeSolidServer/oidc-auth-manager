'use strict'

const AuthResponseSent = require('../errors/auth-response-sent')

class LoginConsentRequest {
  constructor (options) {
    this.opAuthRequest = options.opAuthRequest
    this.params = options.params
    this.response = options.response
  }

  /**
   * @param opAuthRequest {OPAuthenticationRequest}
   * @param skipConsent {boolean}
   *
   * @return {Promise<OPAuthenticationRequest>}
   */
  static handle (opAuthRequest, skipConsent = false) {
    const notLoggedIn = !opAuthRequest.subject
    if (notLoggedIn) {
      return Promise.resolve(opAuthRequest) // pass through
    }

    const consentRequest = LoginConsentRequest.from(opAuthRequest)

    if (skipConsent) {
      consentRequest.markConsentSuccess(opAuthRequest)
      return Promise.resolve(opAuthRequest) // pass through
    }

    return LoginConsentRequest.obtainConsent(consentRequest)
  }

  /**
   * @param opAuthRequest {OPAuthenticationRequest}
   *
   * @return {LoginConsentRequest}
   */
  static from (opAuthRequest) {
    const params = LoginConsentRequest.extractParams(opAuthRequest)

    const options = {
      opAuthRequest,
      params,
      response: opAuthRequest.res
    }

    return new LoginConsentRequest(options)
  }

  static extractParams (opAuthRequest) {
    const req = opAuthRequest.req
    const query = req.query || {}
    const body = req.body || {}
    const params = query.client_id ? query : body
    return params
  }

  /**
   * @param consentRequest {LoginConsentRequest}
   *
   * @return {Promise<OPAuthenticationRequest>}
   */
  static obtainConsent (consentRequest) {
    const { opAuthRequest, clientId } = consentRequest

    const parsedAppOrigin = new URL(consentRequest.opAuthRequest.params.redirect_uri)
    const appOrigin = parsedAppOrigin.origin

    // Consent for the local RP client (the home pod) is implied
    if (consentRequest.isLocalRpClient(appOrigin)) {
      return Promise.resolve()
        .then(() => { consentRequest.markConsentSuccess(opAuthRequest) })
        .then(() => opAuthRequest)
    }

    // Check if user has submitted this from a Consent page
    if (consentRequest.hasAlreadyConsented(appOrigin)) {
      return consentRequest.saveConsentForClient(clientId)
        .then(() => { consentRequest.markConsentSuccess(opAuthRequest) })
        .then(() => opAuthRequest)
    }

    // Otherwise, need to obtain explicit consent from the user via UI
    return consentRequest.checkSavedConsentFor(clientId)
      .then(priorConsent => {
        if (priorConsent) {
          consentRequest.markConsentSuccess(opAuthRequest)
        } else {
          consentRequest.redirectToConsent()
        }
      })
      .then(() => opAuthRequest)
  }

  /**
   * @return {string}
   */
  get clientId () {
    return this.params.client_id
  }

  isLocalRpClient (appOrigin) {
    return this.opAuthRequest.req.app.locals.ldp.serverUri === appOrigin
  }

  hasAlreadyConsented (appOrigin) {
    return this.opAuthRequest.req.session.consentedOrigins &&
      this.opAuthRequest.req.session.consentedOrigins.includes(appOrigin)
  }

  checkSavedConsentFor (opAuthRequest) {
    return Promise.resolve(false)
  }

  markConsentSuccess (opAuthRequest) {
    opAuthRequest.consent = true
    opAuthRequest.scope = this.params.scope
  }

  saveConsentForClient (clientId) {
    return Promise.resolve(clientId)
  }

  redirectToConsent (authRequest) {
    const { opAuthRequest } = this
    console.log('Redirecting user to /sharing')
    console.log(opAuthRequest.host)
    const queryString = new URLSearchParams(opAuthRequest.req.query).toString()
    const consentUrl = `/sharing${queryString ? '?' + queryString : ''}`
    opAuthRequest.subject = null

    opAuthRequest.res.redirect(consentUrl)

    this.signalResponseSent()
  }

  signalResponseSent () {
    throw new AuthResponseSent('User redirected')
  }
}

module.exports = LoginConsentRequest
