'use strict'

class LoginConsentRequest {
  constructor (options) {
    this.authRequest = options.authRequest
    this.params = options.params
    this.response = options.response
  }

  static handle (authRequest) {
    if (!authRequest.subject) {
      return Promise.resolve(authRequest)
    }

    return Promise.resolve()
      .then(() => {
        return LoginConsentRequest.from(authRequest)
      })
      .then(request => {
        return LoginConsentRequest.obtainConsent(request)
      })
  }

  static from (authRequest) {
    let params = LoginConsentRequest.extractParams(authRequest)

    let options = {
      authRequest,
      params,
      response: authRequest.res
    }

    return new LoginConsentRequest(options)
  }

  static extractParams (authRequest) {
    let { req } = authRequest
    let query = req.query || {}
    let body = req.body || {}
    let params = query['client_id'] ? query : body
    return params
  }

  static obtainConsent (request) {
    let { authRequest } = request

    if (request.params.consent) {
      authRequest.consent = true
      authRequest.scope = request.params.scope
    } else {
      authRequest.headersSent = true
      request.renderConsentPage(request.params)
    }

    return Promise.resolve(authRequest)
  }

  renderConsentPage (params) {
    let res = this.response
    res.render('auth/consent', params)
  }
}

module.exports = LoginConsentRequest
