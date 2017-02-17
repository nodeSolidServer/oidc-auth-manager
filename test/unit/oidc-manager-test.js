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
    it('should create an instance from config', () => {
      let providerUri = 'https://localhost:8443'
      let dbPath = './db/oidc'
      let saltRounds = 5

      let options = {
        providerUri,
        dbPath,
        saltRounds
      }

      let oidc = OidcManager.from(options)

      expect(oidc.rs.defaults.query).to.be.true
      expect(oidc.clients.store.backend.path.endsWith('rp/clients'))
      expect(oidc.provider.issuer).to.equal(providerUri)
      expect(oidc.users.backend.path.endsWith('oidc/users'))
      expect(oidc.users.saltRounds).to.equal(saltRounds)
    })
  })

  describe('rsFrom()', () => {
    it('should return an initialized ResourceAuthenticator instance', () => {
      let rs = OidcManager.rsFrom()

      expect(rs).to.respondTo('authenticate')
    })
  })

  describe('multiRpClientFrom()', () => {
    it('should return an initialized MultiRpClient instance', () => {
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/signed_out.html'

      let config = {
        providerUri,
        authCallbackUri,
        postLogoutUri,
        storePath: '/db/oidc'
      }

      let clients = OidcManager.multiRpClientFrom(config)
      expect(clients).to.respondTo('registerClient')
      expect(clients.store.backend.path).to.equal(config.storePath)
    })

    it('should use the provided backend instead of instantiating one', () => {
      let providerUri = 'https://localhost:8443'
      let authCallbackUri = providerUri + '/api/oidc/rp'
      let postLogoutUri = providerUri + '/signed_out.html'
      let backend = {}

      let config = {
        providerUri,
        authCallbackUri,
        postLogoutUri,
        backend
      }

      let clients = OidcManager.multiRpClientFrom(config)
      expect(clients.store.backend).to.equal(backend)
    })
  })

  describe('providerFrom()', () => {
    it('should initialize an OIDCProvider instance', () => {
      let providerUri = 'https://localhost:8443'
      let storePath = './db/oidc/op'
      let host = {
        authenticate: () => {},
        obtainConsent: () => {},
        logout: () => {}
      }
      let config = { providerUri, storePath, host }

      let provider = OidcManager.providerFrom(config)
      expect(provider.backend.path).to.equal(storePath)
      expect(provider.host.authenticate).to.equal(host.authenticate)
      expect(provider.issuer).to.equal(providerUri)
    })
  })
})
