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
    })

    it('should init debug to console by default', () => {
      let request = new AuthCallbackRequest({})

      expect(request.debug).to.exist()
    })
  })

  describe('AuthCallbackRequest.get', () => {
    it('should create a request instance', () => {
      let AuthCallbackRequest = require('../../src/handlers/auth-callback-request')
      let req = HttpMocks.createRequest()
      let next = () => {}

      sinon.spy(AuthCallbackRequest, 'fromParams')
      AuthCallbackRequest.handle = sinon.stub().resolves(null)

      return AuthCallbackRequest.get(req, res, next)
        .then(() => {
          expect(AuthCallbackRequest.fromParams).to.have.been.calledWith(req, res)
        })
    })
  })

  it('throws a 400 error if no issuer_id present')

  describe('getIssuerId()', () => {
    it('should return falsy when req.params.issuer_id is absent')

    // it('should uri-decode issuer_id', () => {
    //   let req = {
    //     params: {
    //       issuer_id: 'https%3A%2F%2Flocalhost'
    //     }
    //   }
    //   expect(getIssuerId(req)).to.equal('https://localhost')
    // })
  })
})
