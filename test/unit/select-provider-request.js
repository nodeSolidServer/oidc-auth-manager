'use strict'

const nock = require('nock')
const chai = require('chai')
const sinon = require('sinon')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
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

  describe('static get()', () => {
    it('creates a request instance and renders the select provider view', () => {
      let serverUri = 'https://example.com'
      let req = {
        app: { locals: { oidc: {}, host: { serverUri } } }
      }
      let res = {}
      res.render = sinon.stub()

      SelectProviderRequest.get(req, res)

      expect(res.render).to.have.been.calledWith('auth/select-provider', { serverUri })
    })
  })

  describe('fetchProviderUri()', () => {
    let serverUri = 'https://example.com'

    it('should extract and validate the provider uri from link rel header', () => {
      nock(serverUri)
        .options('/')
        .reply(204, 'No content', {
          'Link': '<https://example.com>; rel="oidc.provider"'
        })

      let webId = 'https://example.com/#me'
      let request = new SelectProviderRequest({ webId })

      return request.fetchProviderUri()
        .then(providerUri => {
          expect(providerUri).to.equal('https://example.com')
        })
    })

    it('should throw an error if provider returns no link rel header', done => {
      nock(serverUri)
        .options('/')
        .reply(204, 'No content')

      let webId = 'https://example.com/#me'
      let request = new SelectProviderRequest({ webId })

      request.fetchProviderUri()
        .catch(err => {
          expect(err.message).to.include('oidc.provider not advertised')
          done()
        })
    })

    it('should throw an error if provider is unreachable', done => {
      let webId = 'https://example.com/#me'
      let request = new SelectProviderRequest({ webId })

      request.fetchProviderUri()
        .catch(err => {
          expect(err.statusCode).to.equal(400)
          expect(err.message).to.include('Provider not found')
          done()
        })
    })
  })

  describe('selectProvider()', () => {
    it('should fetch the provider uri and redirect user to its /authorize endpoint', () => {
      let webId = 'https://example.com/#me'
      let clientStore = {}
      let authUrl = 'https://example.com/authorize?client_id=1234'
      clientStore.authUrlForIssuer = sinon.stub().resolves(authUrl)
      let oidcManager = { clients: clientStore }

      let response = HttpMocks.createResponse()
      let session = {}

      let request = new SelectProviderRequest({ webId, oidcManager, response, session })

      let providerUri = 'https://example.com'
      request.fetchProviderUri = sinon.stub().resolves(providerUri)

      return request.selectProvider()
        .then(() => {
          expect(request.fetchProviderUri).to.have.been.called()
          expect(clientStore.authUrlForIssuer).to.have.been.calledWith(providerUri, session)
          expect(request.response._getRedirectUrl()).to.equal(authUrl)
        })
    })
  })

  describe('error()', () => {
    it('should render select provider form with appropriate error message', () => {
      let response = HttpMocks.createResponse()
      response.render = sinon.stub()

      let request = new SelectProviderRequest({ response })

      let error = new Error('error message')
      error.statusCode = 404

      request.error(error)

      expect(request.response.statusCode).to.equal(404)
      expect(response.render).to
        .have.been.calledWith('auth/select-provider', { error: 'error message' })
    })
  })

  describe('validateProviderUri()', () => {
    it('throws a 400 on an invalid provider uri', done => {
      let request = new SelectProviderRequest({})

      try {
        request.validateProviderUri('invalid provider uri')
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        expect(error.message).to.include('not a valid URI')
        done()
      }
    })
  })

  describe('handlePost()', () => {
    it('should validate the request and select the provider', () => {
      let request = new SelectProviderRequest({})

      request.validate = sinon.stub().resolves()
      request.selectProvider = sinon.stub().resolves()

      return SelectProviderRequest.handlePost(request)
        .then(() => {
          expect(request.validate).to.have.been.called()
          expect(request.selectProvider).to.have.been.called()
        })
    })

    it('should route any errors to the request.error() handler', done => {
      let request = new SelectProviderRequest({})

      let thrownError = new Error('validation error')
      request.validate = sinon.stub().rejects(thrownError)

      request.error = sinon.stub()

      SelectProviderRequest.handlePost(request)
        .then(() => {
          expect(request.error).to.have.been.calledWith(thrownError)
          done()
        })
    })
  })

  describe('post()', () => {
    let SelectProviderRequest = require('../../src/handlers/select-provider-request')

    it('should create a request instance and invoke handlePost()', () => {
      let req = HttpMocks.createRequest()
      let res = HttpMocks.createResponse()

      let request = new SelectProviderRequest({})

      SelectProviderRequest.fromParams = sinon.stub().returns(request)
      SelectProviderRequest.handlePost = sinon.stub().resolves()

      return SelectProviderRequest.post(req, res)
        .then(() => {
          expect(SelectProviderRequest.fromParams)
            .to.have.been.calledWith(req, res)
          expect(SelectProviderRequest.handlePost)
            .to.have.been.calledWith(request)
        })
    })
  })
})
