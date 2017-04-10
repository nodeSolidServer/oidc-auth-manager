'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const expect = chai.expect
const HttpMocks = require('node-mocks-http')

const SelectProviderRequest = require('../../src/handlers/select-provider-request')

describe('SelectProviderRequest', () => {
  describe('normalizeWebId()', () => {
    it('should prepend https:// if one is missing', () => {
      let result = SelectProviderRequest.normalizeUri('localhost:8443')
      expect(result).to.equal('https://localhost:8443')
    })

    it('should return null if given a null uri', () => {
      let result = SelectProviderRequest.normalizeUri(null)
      expect(result).to.be.null()
    })

    it('should return a valid uri unchanged', () => {
      let result = SelectProviderRequest.normalizeUri('https://alice.example.com')
      expect(result).to.equal('https://alice.example.com')
    })
  })

  describe('validate()', () => {
    it('should throw a 500 error if no oidcManager was initialized', (done) => {
      let aliceWebId = 'https://alice.example.com'
      let options = {
        webId: aliceWebId
      }
      let request = new SelectProviderRequest(options)

      try {
        request.validate()
      } catch (error) {
        expect(error.statusCode).to.equal(500)
        done()
      }
    })

    it('should throw a 400 error if no webid is submitted', (done) => {
      let options = {
        oidcManager: {}
      }
      let request = new SelectProviderRequest(options)

      try {
        request.validate()
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        done()
      }
    })

    it('should throw a 400 if an invalid webid was submitted', (done) => {
      let options = {
        webId: 'invalidWebId',
        oidcManager: {}
      }
      let request = new SelectProviderRequest(options)

      try {
        request.validate()
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        done()
      }
    })
  })

  describe('fromParams()', () => {
    let res = HttpMocks.createResponse()
    let serverUri = 'https://example.com'

    it('should initialize a SelectProviderRequest instance', () => {
      let aliceWebId = 'https://alice.example.com'
      let oidcManager = {}
      let session = {}
      let req = {
        session,
        body: { webid: aliceWebId },
        app: { locals: { oidc: oidcManager, host: { serverUri } } }
      }

      let request = SelectProviderRequest.fromParams(req, res)
      expect(request.webId).to.equal(aliceWebId)
      expect(request.response).to.equal(res)
      expect(request.oidcManager).to.equal(oidcManager)
      expect(request.session).to.equal(session)
      expect(request.serverUri).to.equal(serverUri)
    })

    it('should attempt to normalize an invalid webid uri', () => {
      let oidcManager = {}
      let session = {}
      let req = {
        session,
        body: { webid: 'alice.example.com' },
        app: { locals: { oidc: oidcManager, host: { serverUri } } }
      }

      let request = SelectProviderRequest.fromParams(req, res)
      expect(request.webId).to.equal('https://alice.example.com')
    })
  })
})
