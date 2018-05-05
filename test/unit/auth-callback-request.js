'use strict'

const chai = require('chai')
const sinon = require('sinon')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()

const expect = chai.expect
const HttpMocks = require('node-mocks-http')

const AuthCallbackRequest = require('../../src/handlers/auth-callback-request')

describe('AuthCallbackRequest', () => {
  let res

  beforeEach(() => {
    res = HttpMocks.createResponse()
  })

  describe('constructor()', () => {
    it('should initialize with provided options', () => {
      let options = {
        requestUri: 'https://example.com/api/auth/rp/localhost',
        issuer: 'https://another.server.com',
        oidcManager: {},
        response: res,
        session: {},
        serverUri: 'https://example.com',
        returnToUrl: 'https://example.com/resource',
        debug: {}
      }

      let request = new AuthCallbackRequest(options)

      expect(request.requestUri).to.equal(options.requestUri)
      expect(request.issuer).to.equal(options.issuer)
      expect(request.oidcManager).to.equal(options.oidcManager)
      expect(request.response).to.equal(options.response)
      expect(request.session).to.equal(options.session)
      expect(request.serverUri).to.equal(options.serverUri)
      expect(request.debug).to.equal(options.debug)
      expect(request.returnToUrl).to.equal(options.returnToUrl)
    })

    it('should init debug to console by default', () => {
      let request = new AuthCallbackRequest({})

      expect(request.debug).to.exist()
    })
  })

  describe('AuthCallbackRequest.get', () => {
    it('should create a request instance', () => {
      let AuthCallbackRequest = require('../../src/handlers/auth-callback-request')
      let req = HttpMocks.createRequest({ session: {} })
      let next = () => {}

      sinon.spy(AuthCallbackRequest, 'fromParams')
      AuthCallbackRequest.handle = sinon.stub().resolves(null)

      return AuthCallbackRequest.get(req, res, next)
        .then(() => {
          expect(AuthCallbackRequest.fromParams).to.have.been.calledWith(req, res)
        })
    })
  })

  describe('fromParams()', () => {
    it('should initialize an AuthCallbackRequest instance from request params', () => {
      let AuthCallbackRequest = require('../../src/handlers/auth-callback-request')

      let requestUri = 'https://example.com/api/oidc/rp'
      AuthCallbackRequest.fullUriFor = sinon.stub().returns(requestUri)

      let oidcManager = {}
      let host = { serverUri: 'https://example.com' }
      let returnToUrl = 'https://example.com/resource#hash'
      let session = { returnToUrl: encodeURIComponent(returnToUrl) }

      let req = {
        session,
        app: { locals: { oidc: oidcManager, host } },
        params: {
          'issuer_id': encodeURIComponent(host.serverUri)
        }
      }
      let res = HttpMocks.createResponse()

      let request = AuthCallbackRequest.fromParams(req, res)

      expect(request.issuer).to.equal('https://example.com')
      expect(request.serverUri).to.equal('https://example.com')
      expect(request.requestUri).to.equal(requestUri)
      expect(request.oidcManager).to.equal(oidcManager)
      expect(request.response).to.equal(res)
      expect(request.session).to.equal(session)
      expect(request.returnToUrl).to.equal(returnToUrl)
    })
  })

  describe('static extractReturnToUrl()', () => {
    it('should return null if no returnToUrl is present in session', () => {
      let session = {}

      expect(AuthCallbackRequest.extractReturnToUrl(session))
        .to.be.null()
    })

    it('should return a url-decoded returnToUrl from session', () => {
      let returnToUrl = 'https://example.com/resource#hash'
      let session = { returnToUrl: encodeURIComponent(returnToUrl) }

      expect(AuthCallbackRequest.extractReturnToUrl(session))
        .to.equal(returnToUrl)
    })
  })

  describe('validate()', () => {
    it('should throw an error if issuer param is missing', () => {
      let request = new AuthCallbackRequest({ issuer: 'https://example.com' })

      expect(() => request.validate()).to.not.throw(Error)

      request.issuer = null

      expect(() => request.validate()).to.throw(Error)
    })
  })

  describe('loadClient()', () => {
    it('should load an rp by issuer from the client store', () => {
      let issuer = 'https://example.com'
      let client = {}
      let oidcManager = {
        clients: {}
      }
      oidcManager.clients.clientForIssuer = sinon.stub().resolves(client)

      let request = new AuthCallbackRequest({ issuer, oidcManager })

      return request.loadClient()
        .then(loadedClient => {
          expect(oidcManager.clients.clientForIssuer)
            .to.have.been.calledWith(issuer)
          expect(loadedClient).to.equal(client)
        })
    })
  })

  describe('initSessionUserAuth()', () => {
    let accessToken = {}
    let refreshToken = {}
    let decodedClaims = {}
    let sessionResponse = {
      accessToken,
      refreshToken,
      decoded: { payload: decodedClaims }
    }

    it('should init session with user credentials', () => {
      let aliceWebId = 'https://alice.example.com/#me'
      let oidcManager = {}
      oidcManager.webIdFromClaims = sinon.stub().resolves(aliceWebId)

      let request = new AuthCallbackRequest({ session: {}, oidcManager })

      return request.initSessionUserAuth(sessionResponse)
        .then(() => {
          let session = request.session
          expect(session.accessToken).to.equal(accessToken)
          expect(session.refreshToken).to.equal(refreshToken)
          expect(oidcManager.webIdFromClaims).to.have.been.calledWith(decodedClaims)
          expect(session.userId).to.equal(aliceWebId)
        })
    })
  })

  describe('validateResponse()', () => {
    it('should validate the response', () => {
      let client = {}
      client.validateResponse = sinon.stub().resolves()

      let requestUri = 'https://example.com/callback'
      let session = {}

      let request = new AuthCallbackRequest({ requestUri, session })

      return request.validateResponse(client)
        .then(() => {
          expect(client.validateResponse).to
            .have.been.calledWith(requestUri, session)
        })
    })
  })

  describe('resumeUserWorkflow()', () => {
    it('should redirect to the returnToUrl and clear it from session', () => {
      let response = HttpMocks.createResponse()
      let returnToUrl = 'https://example.com/resource'
      let session = { returnToUrl }

      let request = new AuthCallbackRequest({ session, response, returnToUrl })

      request.resumeUserWorkflow()

      expect(response._getRedirectUrl()).to.equal('https://example.com/resource')
      expect(session.returnToUrl).to.not.exist()
    })
  })
})
