'use strict'

const AuthResponseSent = require('../errors/auth-response-sent')
const url = require('url')

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
    let notLoggedIn = !opAuthRequest.subject
    if (notLoggedIn) {
      return Promise.resolve(opAuthRequest) // pass through
    }

    let consentRequest = LoginConsentRequest.from(opAuthRequest)

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
    let params = LoginConsentRequest.extractParams(opAuthRequest)

    let options = {
      opAuthRequest,
      params,
      response: opAuthRequest.res
    }

    return new LoginConsentRequest(options)
  }

  static extractParams (opAuthRequest) {
    let req = opAuthRequest.req
    let query = req.query || {}
    let body = req.body || {}
    let params = query['client_id'] ? query : body
    return params
  }

  /**
   * @param consentRequest {LoginConsentRequest}
   *
   * @return {Promise<OPAuthenticationRequest>}
   */
  static obtainConsent (consentRequest) {
    let { opAuthRequest, clientId } = consentRequest

    // Consent for the local RP client (the home pod) is implied
    if (consentRequest.isLocalRpClient(consentRequest)) {
      return Promise.resolve()
        .then(() => { consentRequest.markConsentSuccess(opAuthRequest) })
        .then(() => opAuthRequest)
    }

    // Check if user has submitted this from a Consent page
    if (consentRequest.params.consent) {
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
    return this.params['client_id']
  }

  isLocalRpClient (request) {
    const parsedAppOrigin = url.parse(request.opAuthRequest.params.redirect_uri)
    const appOrigin = `${parsedAppOrigin.protocol}//${parsedAppOrigin.host}`
    return request.opAuthRequest.req.app.locals.ldp.serverUri === appOrigin
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
    let { opAuthRequest } = this
    let consentUrl = url.parse('/consent')
    consentUrl.query = opAuthRequest.req.query
  
    consentUrl = url.format(consentUrl)
    opAuthRequest.subject = null
  
    opAuthRequest.res.redirect(consentUrl)
  
    this.signalResponseSent()
  }
  
  signalResponseSent () {
    throw new AuthResponseSent('User redirected to login')
  }
}

module.exports = LoginConsentRequest
