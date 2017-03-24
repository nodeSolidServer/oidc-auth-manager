'use strict'

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()

const OidcManager = require('../../src/oidc-manager')

describe('OidcManager', () => {
  describe('from()', () => {
    it('should create an OidcManager instance from config', () => {
      let providerUri = 'https://localhost:8443'
      let dbPath = './db/oidc'
      let saltRounds = 5
      let host = {}
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/goodbye'

      let options = {
        providerUri,
        dbPath,
        host,
        saltRounds,
        authCallbackUri,
        postLogoutUri
      }

      let oidc = OidcManager.from(options)

      expect(oidc.providerUri).to.equal(providerUri)
      expect(oidc.host).to.equal(host)
      expect(oidc.saltRounds).to.equal(saltRounds)
      expect(oidc.authCallbackUri).to.equal(authCallbackUri)
      expect(oidc.postLogoutUri).to.equal(postLogoutUri)

      let storePaths = oidc.storePaths
      expect(storePaths.providerStore.endsWith('oidc/op'))
      expect(storePaths.multiRpStore.endsWith('oidc/rp'))
      expect(storePaths.userStore.endsWith('oidc/users'))

      expect(oidc.rs).to.exist
      expect(oidc.clients).to.exist
      expect(oidc.users).to.exist
      expect(oidc.provider).exist
    })
  })

  describe('initMultiRpClient()', () => {
    it('should initialize a Multi RP Client Store instance', () => {
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/goodbye'
      let dbPath = './db/oidc-mgr'

      let config = {
        providerUri,
        authCallbackUri,
        postLogoutUri,
        dbPath
      }

      let oidc = OidcManager.from(config)
      oidc.initMultiRpClient()

      let clientStore = oidc.clients
      expect(clientStore.store.backend.path.endsWith('oidc-mgr/rp/clients'))
      expect(clientStore).to.respondTo('registerClient')
    })
  })

  describe('initRs()', () => {
    it('should initialize a Resource Authenticator instance', () => {
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/goodbye'

      let config = { providerUri, authCallbackUri, postLogoutUri }

      let oidc = OidcManager.from(config)
      oidc.initRs()

      expect(oidc.rs.defaults.query).to.be.true
      expect(oidc.rs).to.respondTo('authenticate')
    })
  })

  describe('initUserStore()', () => {
    it('should initialize a UserStore instance', () => {
      let dbPath = './db/oidc-mgr'
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/goodbye'

      let config = {
        providerUri, authCallbackUri, postLogoutUri,
        saltRounds: 5,
        dbPath
      }

      let oidc = OidcManager.from(config)
      oidc.initUserStore()

      expect(oidc.users.backend.path.endsWith('oidc-mgr/users'))
      expect(oidc.users.saltRounds).to.equal(config.saltRounds)
    })
  })

  describe('initProvider()', () => {
    it('should initialize an OIDC Provider instance', () => {
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/goodbye'

      let host = {
        authenticate: () => {},
        obtainConsent: () => {},
        logout: () => {}
      }
      let dbPath = './db/oidc-mgr'
      let config = { providerUri, host, dbPath, authCallbackUri, postLogoutUri }

      let oidc = OidcManager.from(config)

      let loadProviderConfig = sinon.spy(oidc, 'loadProviderConfig')

      oidc.initProvider()

      expect(oidc.provider.issuer).to.equal(providerUri)
      let storePath = oidc.provider.backend.path
      expect(storePath.endsWith('oidc-mgr/op')).to.be.true
      expect(oidc.provider.host.authenticate).to.equal(host.authenticate)
      expect(loadProviderConfig).to.have.been.called
    })
  })

  describe('providerConfigPath()', () => {
    it('should return the Provider config file path', () => {
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/goodbye'
      let dbPath = './db/oidc-mgr'
      let config = { dbPath, providerUri, authCallbackUri, postLogoutUri }

      let oidc = OidcManager.from(config)

      let file = oidc.providerConfigPath()
      expect(file.endsWith('oidc-mgr/op/provider.json')).to.be.true
    })
  })
})
