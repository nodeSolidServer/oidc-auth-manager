'use strict'

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()

const expect = chai.expect
const HttpMocks = require('node-mocks-http')

const LoginConsentRequest = require('../../src/handlers/login-consent-request')

describe('LoginConsentRequest', () => {
  describe('constructor()', () => {
    it('should initialize a new instance', () => {
      let params = { consent: true, scope: 'openid' }
      let options = {
        authRequest: {},
        params,
        response: {}
      }

      let request = new LoginConsentRequest(options)

      expect(request.authRequest).to.equal(options.authRequest)
      expect(request.params).to.equal(options.params)
      expect(request.response).to.equal(options.response)
    })
  })

  describe('extractParams()', () => {
    it('should use req.query if present', () => {
      let req = { query: { client_id: '1234' } }
      let res = HttpMocks.createResponse()
      let authRequest = { req, res }

      let params = LoginConsentRequest.extractParams(authRequest)

      expect(params['client_id']).to.equal(req.query['client_id'])
    })

    it('should use req.body if req.query is not present', () => {
      let req = { body: { client_id: '1234' } }
      let res = HttpMocks.createResponse()
      let authRequest = { req, res }

      let params = LoginConsentRequest.extractParams(authRequest)

      expect(params['client_id']).to.equal(req.body['client_id'])
    })
  })

  describe('from()', () => {
    it('should return an initialized instance', () => {
      let body = { consent: true, scope: 'openid' }
      let req = { body }
      let res = HttpMocks.createResponse()
      let authRequest = { req, res }

      let request = LoginConsentRequest.from(authRequest)

      expect(request.authRequest).to.equal(authRequest)
      expect(request.params).to.equal(req.body)
      expect(request.response).to.equal(res)
    })
  })

  describe('handle()', () => {
    it('should return the authRequest object', () => {
      let res = HttpMocks.createResponse()
      let authRequest = { req: { body: {} }, res, subject: {} }

      return LoginConsentRequest.handle(authRequest)
        .then(returnedRequest => {
          expect(returnedRequest).to.equal(authRequest)
        })
    })

    it('should invoke obtainConsent()', () => {
      let res = HttpMocks.createResponse()
      let authRequest = { req: { body: {} }, res, subject: {} }

      let obtainConsent = sinon.spy(LoginConsentRequest, 'obtainConsent')

      return LoginConsentRequest.handle(authRequest)
        .then(() => {
          expect(obtainConsent).to.have.been.called
          obtainConsent.reset()
        })
    })

    it('should not invoke obtainConsent() if subject is missing', () => {
      let res = HttpMocks.createResponse()
      let authRequest = { req: { body: {} }, res }

      return LoginConsentRequest.handle(authRequest)
        .then(() => {
          expect(LoginConsentRequest.obtainConsent).to.not.have.been.called
        })
    })
  })

  describe('obtainConsent()', () => {
    describe('if body.consent param is present', () => {
      let req, res, authRequest

      beforeEach(() => {
        req = { body: { consent: true, scope: 'openid' } }
        res = HttpMocks.createResponse()
        authRequest = { req, res }
      })

      it('should set consent property on request', () => {
        let request = LoginConsentRequest.from(authRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(authRequest => {
            expect(authRequest.consent).to.be.true
            expect(authRequest.headersSent).to.be.falsy
          })
      })

      it('should set scope property on request', () => {
        let request = LoginConsentRequest.from(authRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(authRequest => {
            expect(authRequest.scope).to.equal('openid')
          })
      })

      it('should not render any pages', () => {
        let render = sinon.stub(authRequest.res, 'render')
        let request = LoginConsentRequest.from(authRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(authRequest => {
            expect(render).to.not.have.been.called
          })
      })
    })

    describe('if body.consent param is NOT present', () => {
      let req, res, authRequest

      beforeEach(() => {
        req = { body: {} }
        res = HttpMocks.createResponse()
        authRequest = { req, res }
      })

      it('should set the headerSent property on authRequest', () => {
        let request = LoginConsentRequest.from(authRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(authRequest => {
            expect(authRequest.headersSent).to.be.true
          })
      })

      it('should call renderConsentPage()', () => {
        let request = LoginConsentRequest.from(authRequest)

        let renderConsentPage = sinon.stub(request, 'renderConsentPage')

        return LoginConsentRequest.obtainConsent(request)
          .then(() => {
            expect(renderConsentPage).to.have.been.calledWith(req.body)
          })
      })
    })
  })

  describe('renderConsentPage()', () => {
    it('should call res.render', () => {
      let req = { body: {} }
      let res = HttpMocks.createResponse()

      let render = sinon.stub(res, 'render')

      let authRequest = { req, res }
      let request = LoginConsentRequest.from(authRequest)

      return LoginConsentRequest.obtainConsent(request)
        .then(() => {
          expect(render).to.have.been.calledWith('auth/consent')
        })
    })
  })
})
