'use strict'

const validUrl = require('valid-url')
const fetch = require('node-fetch')
const li = require('li')

class SelectProviderRequest {
  /**
   * @constructor
   *
   * @param options {Object}
   * @param [options.webId] {string}
   * @param [options.oidcManager] {OidcManager}
   * @param [options.response] {HttpResponse}
   * @param [options.serverUri] {string}
   */
  constructor (options) {
    this.webId = options.webId
    this.oidcManager = options.oidcManager
    this.response = options.response
    this.session = options.session
    this.serverUri = options.serverUri
  }

  /**
   * Validates the request and throws an error if invalid.
   *
   * @throws {Error} HTTP 400 if required parameters are missing
   */
  validate () {
    if (!this.webId) {
      let error = new Error('No webid is given for Provider Discovery')
      error.statusCode = 400
      throw error
    }

    if (!validUrl.isUri(this.webId)) {
      let error = new Error('Invalid webid given for Provider Discovery')
      error.statusCode = 400
      throw error
    }

    if (!this.oidcManager) {
      let error = new Error('OIDC multi-rp client not initialized')
      error.statusCode = 500
      throw error
    }
  }

  /**
   * Factory method, creates and returns an initialized and validated instance
   * of SelectProviderRequest from a submitted POST form.
   *
   * @param req {IncomingRequest}
   * @param [req.body.webid] {string}
   *
   * @param res {ServerResponse}

   * @return {SelectProviderRequest}
   */
  static fromParams (req, res) {
    let body = req.body || {}
    let webId = SelectProviderRequest.normalizeUri(body.webid)

    let oidcManager, serverUri
    if (req.app && req.app.locals) {
      let locals = req.app.locals
      oidcManager = locals.oidc
      serverUri = locals.host.serverUri
    }

    let options = {
      webId,
      oidcManager,
      serverUri,
      response: res,
      session: req.session
    }

    let request = new SelectProviderRequest(options)

    return request
  }

  /**
   * Attempts to return a normalized URI by prepending `https://` to a given
   * value, if a protocol is missing.
   *
   * @param uri {string}
   *
   * @return {string}
   */
  static normalizeUri (uri) {
    if (!uri) {
      return uri
    }

    if (!uri.startsWith('http')) {
      uri = 'https://' + uri
    }

    return uri
  }

  /**
   * Handles the Select Provider POST request. Usage:
   *
   *   ```
   *   app.post('/api/auth/select-provider', bodyParser, SelectProviderRequest.post })
   *   ```
   *
   * @param req {IncomingRequest}
   * @param res {ServerResponse}
   *
   * @throws {Error}
   *
   * @return {Promise}
   */
  static post (req, res) {
    const request = SelectProviderRequest.fromParams(req, res)

    return SelectProviderRequest.handlePost(request)
  }

  static handlePost (request) {
    return Promise.resolve()
      .then(() => request.validate())
      .then(() => request.selectProvider())
      .catch(err => request.error(err))
  }

  /**
   * Handles a Select Provider GET request on behalf of a middleware handler. Usage:
   *
   *   ```
   *   app.get('/api/auth/select-provider', SelectProviderRequest.get)
   *   ```
   *
   * @param req {IncomingRequest}
   * @param res {ServerResponse}
   */
  static get (req, res) {
    const request = SelectProviderRequest.fromParams(req, res)

    request.renderView()
  }

  /**
   * Performs provider discovery by determining a user's preferred provider uri,
   * constructing an authentication url for that provider, and redirecting the
   * user to it.
   *
   * @throws {Error}
   *
   * @return {Promise}
   */
  selectProvider () {
    return this.fetchProviderUri()
      .then(providerUrl => this.authUrlFor(providerUrl))
      .then(providerAuthUrl => this.response.redirect(providerAuthUrl))
  }

  /**
   * Determines the preferred provider for the given Web ID by making an http
   * OPTIONS request to it and parsing the `oidc.provider` Link header.
   *
   * @throws {Error} If unable to reach the Web ID URI, or if no valid
   *   `oidc.provider` was advertised.
   *
   * @return {Promise<string>}
   */
  fetchProviderUri () {
    let uri = this.webId

    return this.requestOptions(uri)
      .then(this.parseProviderLink)
      .then(providerUri => {
        this.validateProviderUri(providerUri)  // Throw an error if invalid

        return providerUri
      })
  }

  /**
   * Performs an HTTP OPTIONS call to a given uri, and returns the response
   * headers.
   *
   * @param uri {string} Typically a Web ID or profile uri
   *
   * @return {Promise<Headers>}
   */
  requestOptions (uri) {
    return fetch(uri, { method: 'OPTIONS' })
      .then(response => {
        return response.headers
      })
      .catch(() => {
        let error = new Error(`Provider not found at uri: ${uri}`)
        error.statusCode = 400
        throw error
      })
  }

  /**
   * Returns the contents of the `oidc.provider` Link rel header.
   *
   * @param headers {Headers} Response headers from an OPTIONS call
   *
   * @return {string}
   */
  parseProviderLink (headers) {
    let links = li.parse(headers.get('link')) || {}

    return links['oidc.provider']
  }

  /**
   * Validates a preferred provider uri (makes sure it's a well-formed URI).
   *
   * @param provider {string} Identity provider URI
   *
   * @throws {Error} If the URI is invalid
   */
  validateProviderUri (provider) {
    if (!provider) {
      let error = new Error(`oidc.provider not advertised for ${this.webId}`)
      error.statusCode = 400
      throw error
    }

    if (!validUrl.isUri(provider)) {
      let error = new Error(`oidc.provider for ${this.webId} is not a valid URI: ${provider}`)
      error.statusCode = 400
      throw error
    }
  }

  /**
   * Constructs the OIDC authorization URL for a given provider.
   *
   * @param providerUri {string} Identity provider URI
   *
   * @return {Promise<string>}
   */
  authUrlFor (providerUri) {
    let multiRpClient = this.oidcManager.clients

    return multiRpClient.authUrlForIssuer(providerUri, this.session)
  }

  error (error) {
    let res = this.response

    res.status(error.statusCode || 400)

    res.render('auth/select-provider', { error: error.message })
  }

  renderView () {
    let res = this.response

    res.render('auth/select-provider', { serverUri: this.serverUri })
  }
}

module.exports = SelectProviderRequest
