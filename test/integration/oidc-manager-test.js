'use strict'

const fs = require('fs-extra')
const path = require('path')
const chai = require('chai')
const expect = chai.expect
chai.should()

const OidcManager = require('../../src/oidc-manager')

const dbPath = path.resolve(__dirname, '../db/oidc')
const serverUri = 'https://example.com'

describe('OidcManager (integration tests)', () => {
  beforeEach(() => {
    fs.removeSync(dbPath)
    fs.mkdirpSync(dbPath)
  })

  describe('loadProviderConfig()', () => {
    it('it should return a minimal config if no saved config present', () => {
      let config = {
        host: {},
        providerUri: serverUri,
        dbPath
      }
      let oidc = OidcManager.from(config)

      let providerConfig = oidc.loadProviderConfig()
      expect(providerConfig.issuer).to.equal(serverUri)
      expect(providerConfig.keys).to.not.exist
    })

    it('should attempt to load a previously saved provider config', () => {
      let config = {
        host: {},
        providerUri: serverUri,
        dbPath
      }

      let oidc = OidcManager.from(config)

      return oidc.initialize()
        .then(() => {
          oidc.saveProviderConfig()

          let providerConfig = oidc.loadProviderConfig()

          expect(providerConfig.issuer).to.equal(serverUri)
          expect(providerConfig.authorization_endpoint).to.exist
          expect(providerConfig.keys).to.exist
        })
    })
  })
})
