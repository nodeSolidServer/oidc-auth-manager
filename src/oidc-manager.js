'use strict'

const path = require('path')
const ResourceAuthenticator = require('oidc-rs')
const KVPFileStore = require('kvplus-files')
const MultiRpClient = require('solid-multi-rp-client')
const OIDCProvider = require('oidc-op')
const UserStore = require('./user-store')

const DEFAULT_DB_PATH = './db/oidc'

const DEFAULT_RS_CONFIG = { handleErrors: false, optional: true, query: true }

class OidcManager {
  /**
   * @constructor
   * @param [options={}] {Object}
   * @param [options.rs] {ResourceServer} An `oidc-rs` resource authenticator.
   * @param [options.clients] {MultiRpClient}
   * @param [options.provider] {Provider} OpenID Connect Identity Provider (OP)
   * @param [options.users] {UserStore}
   */
  constructor (options = {}) {
    this.rs = options.rs
    this.clients = options.clients
    this.provider = options.provider
    this.users = options.users

    this.debug = options.debug || console.log.bind(console)
  }

  /**
   * Factory method, initializes and returns an instance of OidcManager.
   *
   * @param [config={}] {Object} Options hashmap object
   *
   * @param [config.dbPath='./db/oidc'] {string} Folder in which to store the
   *   auth-related collection stores (users, clients, tokens).
   *
   * Config for OIDCProvider:
   * @param [config.providerUri] {string} URI of the OpenID Connect Provider
   * @param [config.host] {Object}
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
  static from (config = {}) {
    let paths = OidcManager.storePathsFrom(config.dbPath)

    let multiRpConfig = {
      providerUri: config.providerUri,
      authCallbackUri: config.authCallbackUri,
      postLogoutUri: config.postLogoutUri,
      storePath: paths.multiRpStore
    }

    let providerConfig = {
      providerUri: config.providerUri,
      host: config.host,
      storePath: paths.providerStore
    }

    let userStoreConfig = {
      saltRounds: config.saltRounds,
      storePath: paths.userStore
    }

    let options = {
      rs: OidcManager.rsFrom(),
      clients: OidcManager.multiRpClientFrom(multiRpConfig),
      provider: OidcManager.providerFrom(providerConfig),
      users: OidcManager.userStoreFrom(userStoreConfig)
    }

    return new OidcManager(options)
  }

  initialize () {
    return Promise.resolve()
      .then(() => {
        this.clients.store.backend.initCollections()
        this.provider.backend.initCollections()
        this.users.initCollections()

        // provider.initializeKeyChain(providerConfig.keys)
        return this.provider.initializeKeyChain()
      })
      .then(keys => {
        // fs.writeFileSync('provider.json', JSON.stringify(provider, null, 2))
        this.debug('Provider keychain initialized')
      })
  }

  static userStoreFrom (config = {}) {
    return UserStore.from({
      path: config.storePath,
      saltRounds: config.saltRounds
    })
  }

  /**
   * @param [config={}] {Object}
   *
   * @param config.providerUri {string}
   *
   * @param [config.storePath] {string}
   * @param [config.backend] {KVPFileStore}
   *
   * @param config.host {Object}
   * @param config.host.authenticate {Function}
   * @param config.host.obtainConsent {Function}
   * @param config.host.logout {Function}
   *
   * @return {OIDCProvider}
   */
  static providerFrom (config = {}) {
    // let providerConfig = require(path.join(__dirname, '../provider.json'))
    // let provider = new OIDCProvider(providerConfig)

    let provider = new OIDCProvider({ issuer: config.providerUri })

    let backend = config.backend ||
        new KVPFileStore({
          path: config.storePath,
          collections: ['codes', 'clients', 'tokens', 'refresh']
        })
    provider.inject({ backend })

    provider.inject({ host: config.host })

    return provider
  }

  /**
   * @param [config={}] {Object}
   *
   * @param [config.providerUri] {string}
   * @param [config.authCallbackUri] {string}
   * @param [config.postLogoutUri] {string}
   *
   * Configure ClientStore backend:
   * @param [config.backend] {KVPFileStore}
   * @param [config.storePath] {string}
   *
   * @return {MultiRpClient}
   */
  static multiRpClientFrom (config) {
    let localRPConfig = {
      'issuer': config.providerUri,
      'redirect_uri': config.authCallbackUri,
      'post_logout_redirect_uris': [ config.postLogoutUri ]
    }

    let backend = config.backend ||
      new KVPFileStore({
        path: config.storePath,
        collections: ['clients']
      })

    let clientOptions = { backend, localConfig: localRPConfig }

    return new MultiRpClient(clientOptions)
  }

  static rsFrom () {
    let rsOptions = {  // oidc-rs
      defaults: DEFAULT_RS_CONFIG
    }
    return new ResourceAuthenticator(rsOptions)
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
