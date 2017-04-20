'use strict'

const url = require('url')

class AuthCallbackRequest {
  constructor (options) {
    this.requestUri = options.requestUri
    this.issuer = options.issuer
    this.oidcManager = options.oidcManager
    this.response = options.response
    this.session = options.session
    this.returnToUrl = options.returnToUrl || '/'
    this.serverUri = options.serverUri
    this.debug = options.debug || console.log.bind(console)
  }

  /**
   * Usage:
   *
   *   ```
   *   router.get('/api/oidc/rp/:issuer_id', AuthCallbackRequest.get)
   *   ```
   *
   * @param req
   * @param res
   * @param next
   *
   * @returns {Promise}
   */
  static get (req, res, next) {
    const request = AuthCallbackRequest.fromParams(req, res)

    return AuthCallbackRequest.handle(request)
      .catch(next)
  }

  /**
   * Factory method, creates and returns an initialized and validated instance
   * of AuthCallbackRequest from a redirected GET request.
   *
   * @param req {IncomingRequest}
   *
   * @param res {ServerResponse}

   * @return {AuthCallbackRequest}
   */
  static fromParams (req, res) {
    let oidcManager, serverUri
    if (req.app && req.app.locals) {
      let locals = req.app.locals
      oidcManager = locals.oidc
      serverUri = locals.host.serverUri
    }

    let requestUri = AuthCallbackRequest.fullUriFor(req)

    let issuer = AuthCallbackRequest.extractIssuer(req)

    let options = {
      issuer,
      requestUri,
      oidcManager,
      serverUri,
      response: res,
      session: req.session,
      returnToUrl: req.session.returnToUrl
    }

    let request = new AuthCallbackRequest(options)

    return request
  }

  static fullUriFor (req) {
    return url.format({
      protocol: req.protocol,
      host: req.get('host'),
      pathname: req.path,
      query: req.query
    })
  }

  // Exchange authorization code for id token
  static handle (request) {
    return Promise.resolve()
      .then(() => request.validate())
      .then(() => request.loadClient())
      .then(rpClient => request.validateResponse(rpClient))
      .then(authResponse => request.initSessionUserAuth(authResponse))
      .then(() => request.resumeUserWorkflow())
  }

  static extractIssuer (req) {
    return req.params && decodeURIComponent(req.params.issuer_id)
  }

  validate () {
    if (!this.issuer) {
      let error = new Error('Issuer id is missing from request params')
      error.statusCode = 400
      throw error
    }
  }

  loadClient () {
    let rpClientStore = this.oidcManager.clients

    return rpClientStore.clientForIssuer(this.issuer)
  }

  initSessionUserAuth (authResponse) {
    this.session.accessToken = authResponse.params.access_token
    this.session.refreshToken = authResponse.params.refresh_token

    let claims = authResponse.decoded.payload
    let webId = this.oidcManager.webIdFromClaims(claims)

    this.session.userId = webId
    this.session.identified = true
  }

  /**
   * Validates the authentication response and decodes the credentials.
   * Also performs auth code exchange (trading an authorization code for an
   * id token and access token), if applicable.
   *
   * @param client {RelyingParty}
   *
   * @return {AuthenticationResponse} Containing the access_token and
   *   refresh_token in its `params` property.
   */
  validateResponse (client) {
    return client.validateResponse(this.requestUri, this.session)
  }

  /**
   * Redirects the user back to their original requested resource, at the end
   * of the OIDC authentication process.
   */
  resumeUserWorkflow () {
    this.debug('  Resuming workflow, redirecting to ' + this.returnToUrl)

    delete this.session.returnToUrl
    return this.response.redirect(302, this.returnToUrl)
  }
}

module.exports = AuthCallbackRequest
