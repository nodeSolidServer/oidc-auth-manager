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
   *
   * @returns {Promise}
   */
  static get (req, res) {
    const request = AuthCallbackRequest.fromParams(req, res)

    return AuthCallbackRequest.handle(request)
      .catch(error => {
        request.debug('Error in AuthCallbackRequest:', error)
        res.redirect('/login')
      })
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
    let returnToUrl = AuthCallbackRequest.extractReturnToUrl(req.session)

    let options = {
      issuer,
      requestUri,
      oidcManager,
      serverUri,
      returnToUrl,
      response: res,
      session: req.session
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
      .then(session => request.initSessionUserAuth(session))
      .then(() => request.resumeUserWorkflow())
  }

  static extractIssuer (req) {
    return req.params && decodeURIComponent(req.params.issuer_id)
  }

  /**
   * Extracts the `returnToUrl` that was stored in session during the
   * SelectProviderRequest handling.
   *
   * @param session
   *
   * @returns {string|null}
   */
  static extractReturnToUrl (session) {
    const returnToUrl = session.returnToUrl

    return returnToUrl ? decodeURIComponent(returnToUrl) : null
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

  /**
   * @param session
   *
   * @returns {Promise}
   */
  initSessionUserAuth (session) {
    Object.assign(this.session, session)

    let claims = session.decoded.payload

    return this.oidcManager.webIdFromClaims(claims)
      .then(webId => {
        this.session.userId = webId
      })
      .catch(err => {
        let error = new Error('Could not verify Web ID from token claims')
        error.statusCode = 401
        error.cause = err
        throw error
      })
  }

  /**
   * Validates the authentication response and decodes the credentials.
   * Also performs auth code exchange (trading an authorization code for an
   * id token and access token), if applicable.
   *
   * @param client {RelyingParty}
   *
   * @return {Session} Containing the `idToken` and `accessToken` properties
   */
  validateResponse (client) {
    return client.validateResponse(this.requestUri, this.session)
      .catch(error => {
        error.statusCode = 400
        console.log('Error in callback/validateResponse:', error)
        throw error
      })
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
