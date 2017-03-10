'use strict'

const fs = require('fs-extra')
const path = require('path')
const ResourceAuthenticator = require('oidc-rs')
const KVPFileStore = require('kvplus-files')
const MultiRpClient = require('solid-multi-rp-client')
const OIDCProvider = require('oidc-op')
const UserStore = require('./user-store')

const HostAPI = require('./host-api')

const DEFAULT_DB_PATH = './db/oidc'

const DEFAULT_RS_CONFIG = { handleErrors: false, optional: true, query: true }

class OidcManager {
  /**
   * @param [options={}] {Object}
   * @param [options.rs] {ResourceServer} An `oidc-rs` resource authenticator.
   * @param [options.clients] {MultiRpClient}
   * @param [options.provider] {Provider} OpenID Connect Identity Provider (OP)
   * @param [options.users] {UserStore}
   */

  /**
   * Factory method, initializes and returns an instance of OidcManager.
   *
   * @param options {Object} Options hashmap object
   *
   * @param [options.storePaths] {Object}
   * @param [options.storePaths.multiRpStore] {string}
   * @param [options.storePaths.providerStore] {string}
   * @param [options.storePaths.userStore] {string}
   *
   * Config for OIDCProvider:
   * @param [options.providerUri] {string} URI of the OpenID Connect Provider
   *
   * @param [options.host] {Object} Injected host behavior object
   * @param [options.host.authenticate] {Function}
   * @param [options.host.obtainConsent] {Function}
   * @param [options.host.logout] {Function}
   *
   * Config for MultiRpClient:
   * @param [options.authCallbackUri] {string}
   * @param [options.postLogoutUri] {string}
   *
   * Config for UserStore:
   * @param [options.saltRounds] {number} Number of bcrypt password salt rounds
   *
   * @param [options.debug] {Function} Debug function (defaults to console.log)
   */
  constructor (options) {
    this.storePaths = options.storePaths

    this.providerUri = options.providerUri
    this.host = options.host

    this.authCallbackUri = options.authCallbackUri
    this.postLogoutUri = options.postLogoutUri

    this.saltRounds = options.saltRounds

    this.rs = null
    this.clients = null
    this.provider = null
    this.users = null

    this.debug = options.debug || console.log.bind(console)
  }

  /**
   * Factory method, initializes and returns an instance of OidcManager.
   *
   * @param config {Object} Options hashmap object
   *
   * @param [config.dbPath='./db/oidc'] {string} Folder in which to store the
   *   auth-related collection stores (users, clients, tokens).
   *
   * Config for OIDCProvider:
   * @param [config.providerUri] {string} URI of the OpenID Connect Provider
   * @param [config.host] {Object} Injected host behavior object,
   *   see `providerFrom()` docstring.
   *
   * Config for MultiRpClient:
   * @param [config.authCallbackUri] {string}
   * @param [config.postLogoutUri] {string}
   *
   * Config for UserStore:
   * @param [config.saltRounds] {number} Number of bcrypt password salt rounds
   *
   * @return {OidcManager}
   */
  static from (config) {
    let options = {
      providerUri: config.providerUri,
      host: config.host,
      authCallbackUri: config.authCallbackUri,
      postLogoutUri: config.postLogoutUri,
      saltRounds: config.saltRounds,
      storePaths: OidcManager.storePathsFrom(config.dbPath)
    }
    let oidc = new OidcManager(options)

    oidc.initMultiRpClient()
    oidc.initRs()
    oidc.initUserStore()
    oidc.initProvider()

    return oidc
  }

  /**
   * Initializes on-disk resources required for OidcManager operation
   * (creates the various storage directories), and generates the provider's
   * crypto keychain (either from a previously generated and serialized config,
   * or from scratch).
   *
   * @return {Promise}
   */
  initialize () {
    return Promise.resolve()
      .then(() => {
        this.clients.store.backend.initCollections()
        this.provider.backend.initCollections()
        this.users.initCollections()

        return this.initProviderKeychain()
      })
  }

  initMultiRpClient () {
    let localRPConfig = {
      'issuer': this.providerUri,
      'redirect_uri': this.authCallbackUri,
      'post_logout_redirect_uris': [ this.postLogoutUri ]
    }

    let backend = new KVPFileStore({
      path: this.storePaths.multiRpStore,
      collections: ['clients']
    })

    let clientOptions = { backend, localConfig: localRPConfig }

    this.clients = new MultiRpClient(clientOptions)
  }

  initRs () {
    let rsConfig = {  // oidc-rs
      defaults: DEFAULT_RS_CONFIG
    }
    this.rs = new ResourceAuthenticator(rsConfig)
  }

  initUserStore () {
    let userStoreConfig = {
      saltRounds: this.saltRounds,
      path: this.storePaths.userStore
    }
    this.users = UserStore.from(userStoreConfig)
  }

  initProvider () {
    let providerConfig = this.loadProviderConfig()
    let provider = new OIDCProvider(providerConfig)
    if (providerConfig.keys) {
      provider.keys = providerConfig.keys
    }

    let backend = new KVPFileStore({
      path: this.storePaths.providerStore,
      collections: ['codes', 'clients', 'tokens', 'refresh']
    })
    provider.inject({ backend })

    // Init the injected host API (authenticate / obtainConsent / logout)
    let host = this.host || {}
    host = Object.assign(host, HostAPI)

    provider.inject({ host })

    this.provider = provider
  }

  initProviderKeychain () {
    if (this.provider.keys) {
      this.debug('Provider keys loaded from config')
    } else {
      this.debug('No provider keys found, generating fresh ones')
    }

    return this.provider.initializeKeyChain(this.provider.keys)
      .then(keys => {
        this.debug('Provider keychain initialized')
      })
  }

  providerConfigPath () {
    let storePath = this.storePaths.providerStore

    return path.join(storePath, 'provider.json')
  }

  /**
   * Returns a previously serialized Provider config if one is available on disk,
   * otherwise returns a minimal config object (with just the `issuer` set).
   *
   * @return {Object}
   */
  loadProviderConfig () {
    let providerConfig = {}
    let storedConfig
    let configPath = this.providerConfigPath()

    try {
      storedConfig = fs.readFileSync(configPath, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') { throw error }
    }

    if (storedConfig) {
      providerConfig = JSON.parse(storedConfig)
    } else {
      providerConfig.issuer = this.providerUri
    }

    return providerConfig
  }

  saveProviderConfig () {
    let configPath = this.providerConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(this.provider, null, 2))
  }

  static storePathsFrom (dbPath = DEFAULT_DB_PATH) {
    // Assuming dbPath = 'db/oidc'
    return {
      // RelyingParty client store path (results in 'db/oidc/rp/clients')
      multiRpStore: path.resolve(dbPath, 'rp'),

      // User store path (results in 'db/oidc/user/['users', 'users-by-email'])
      userStore: path.resolve(dbPath, 'users'),

      // Identity Provider store path (db/oidc/op/['codes', 'clients', 'tokens', 'refresh'])
      providerStore: path.resolve(dbPath, 'op')
    }
  }
}

module.exports = OidcManager
module.exports.DEFAULT_DB_PATH = DEFAULT_DB_PATH
module.exports.DEFAULT_RS_CONFIG = DEFAULT_RS_CONFIG
