'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
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
        opAuthRequest: {},
        params,
        response: {}
      }

      let request = new LoginConsentRequest(options)

      expect(request.opAuthRequest).to.equal(options.opAuthRequest)
      expect(request.params).to.equal(options.params)
      expect(request.response).to.equal(options.response)
    })
  })

  describe('extractParams()', () => {
    it('should use req.query if present', () => {
      let req = { query: { client_id: '1234' } }
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req, res }

      let params = LoginConsentRequest.extractParams(opAuthRequest)

      expect(params['client_id']).to.equal(req.query['client_id'])
    })

    it('should use req.body if req.query is not present', () => {
      let req = { body: { client_id: '1234' } }
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req, res }

      let params = LoginConsentRequest.extractParams(opAuthRequest)

      expect(params['client_id']).to.equal(req.body['client_id'])
    })
  })

  describe('from()', () => {
    it('should return an initialized instance', () => {
      let body = { consent: true, scope: 'openid' }
      let req = { body }
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req, res }

      let request = LoginConsentRequest.from(opAuthRequest)

      expect(request.opAuthRequest).to.equal(opAuthRequest)
      expect(request.params).to.equal(req.body)
      expect(request.response).to.equal(res)
    })
  })

  describe('handle()', () => {
    it('should return the opAuthRequest object', () => {
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req: { body: {} }, res, subject: {} }

      return LoginConsentRequest.handle(opAuthRequest)
        .then(returnedRequest => {
          expect(returnedRequest).to.equal(opAuthRequest)
        })
    })

    it('should invoke obtainConsent()', () => {
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req: { body: {} }, res, subject: {} }

      let obtainConsent = sinon.spy(LoginConsentRequest, 'obtainConsent')

      return LoginConsentRequest.handle(opAuthRequest)
        .then(() => {
          expect(obtainConsent).to.have.been.called()
          obtainConsent.resetHistory()
        })
    })

    it('should pass through opAuthRequest if skipConsent is set', () => {
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req: { body: {} }, res, subject: {} }
      let skipConsent = true

      return LoginConsentRequest.handle(opAuthRequest, skipConsent)
        .then(() => {
          expect(LoginConsentRequest.obtainConsent).to.not.have.been.called()
          LoginConsentRequest.obtainConsent.resetHistory()
        })
    })

    it('should not invoke obtainConsent() if subject is missing', () => {
      let res = HttpMocks.createResponse()
      let opAuthRequest = { req: { body: {} }, res }

      return LoginConsentRequest.handle(opAuthRequest)
        .then(() => {
          expect(LoginConsentRequest.obtainConsent).to.not.have.been.called()
        })
    })
  })

  describe('clientId getter', () => {
    it('should return the client_id param', () => {
      let res = HttpMocks.createResponse()
      let body = { 'client_id': '1234' }
      let opAuthRequest = { req: { body }, res }

      let request = LoginConsentRequest.from(opAuthRequest)

      expect(request.clientId).to.equal('1234')
    })
  })

  describe('isLocalRpClient()', () => {
    it('should be false if host has no local client initialized', () => {
      let params = { 'client_id': '1234' }
      let response = HttpMocks.createResponse()
      let opAuthRequest = { host: {} }

      let request = new LoginConsentRequest({ params, response, opAuthRequest })

      expect(request.isLocalRpClient('1234')).to.be.false()
    })

    it('should be false if params has no client id', () => {
      let params = {}
      let response = HttpMocks.createResponse()
      let opAuthRequest = {
        host: {}
      }

      let request = new LoginConsentRequest({ params, response, opAuthRequest })

      expect(request.isLocalRpClient(undefined)).to.be.false()
    })

    it('should be false if host local client id does not match params', () => {
      let params = { 'client_id': '1234' }
      let response = HttpMocks.createResponse()
      let opAuthRequest = {
        host: {
          localClientId: '5678'
        }
      }

      let request = new LoginConsentRequest({ params, response, opAuthRequest })

      expect(request.isLocalRpClient('1234')).to.be.false()
    })

    it('should be true if host local client id equals param client_id', () => {
      let params = { 'client_id': '1234' }
      let response = HttpMocks.createResponse()
      let opAuthRequest = {
        host: {
          localClientId: '1234'
        }
      }

      let request = new LoginConsentRequest({ params, response, opAuthRequest })

      expect(request.isLocalRpClient('1234')).to.be.true()
    })
  })

  describe('obtainConsent()', () => {
    describe('if request is for a local rp client', () => {
      let req, res, opAuthRequest
      const host = { localClientId: '1234' }
      const clientId = '1234'

      beforeEach(() => {
        req = { body: { scope: 'openid', client_id: clientId } }
        res = HttpMocks.createResponse()
        opAuthRequest = { req, res, host }
      })

      it('should mark successful consent automatically', () => {
        let request = LoginConsentRequest.from(opAuthRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(opAuthRequest => {
            expect(opAuthRequest.consent).to.be.true()
            expect(opAuthRequest.scope).to.equal('openid')
          })
      })

      it('should not call checkSavedConsentFor()', () => {
        let request = LoginConsentRequest.from(opAuthRequest)

        let checkSavedConsentFor = sinon.spy(request, 'checkSavedConsentFor')

        return LoginConsentRequest.obtainConsent(request)
          .then(() => {
            expect(checkSavedConsentFor).to.not.have.been.called()
          })
      })
    })

    describe('if body.consent param is present', () => {
      let req, res, opAuthRequest
      const host = {}
      const clientId = '1234'

      beforeEach(() => {
        req = { body: { consent: true, scope: 'openid', client_id: clientId } }
        res = HttpMocks.createResponse()
        opAuthRequest = { req, res, host }
      })

      it('should call saveConsentForClient()', () => {
        let request = LoginConsentRequest.from(opAuthRequest)

        request.saveConsentForClient = sinon.mock().returns(Promise.resolve())

        return LoginConsentRequest.obtainConsent(request)
          .then(() => {
            expect(request.saveConsentForClient).to.have.been.called()
          })
      })

      it('should set consent property on request', () => {
        let request = LoginConsentRequest.from(opAuthRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(opAuthRequest => {
            expect(opAuthRequest.consent).to.be.true()
          })
      })

      it('should set scope property on request', () => {
        let request = LoginConsentRequest.from(opAuthRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(opAuthRequest => {
            expect(opAuthRequest.scope).to.equal('openid')
          })
      })

      it('should not render any pages', () => {
        let render = sinon.stub(opAuthRequest.res, 'render')
        let request = LoginConsentRequest.from(opAuthRequest)

        return LoginConsentRequest.obtainConsent(request)
          .then(opAuthRequest => {
            expect(render).to.not.have.been.called()
          })
      })
    })

    describe('if body.consent param is NOT present', () => {
      let req, res, opAuthRequest

      beforeEach(() => {
        req = { body: { scope: 'openid' } }
        res = HttpMocks.createResponse()
        opAuthRequest = { req, res }
      })

      it('should check for previously saved consent', () => {
        let request = LoginConsentRequest.from(opAuthRequest)

        request.checkSavedConsentFor = sinon.mock()
          .returns(Promise.resolve(false))

        return LoginConsentRequest.obtainConsent(request)
          .then(() => {
            expect(request.checkSavedConsentFor).to.have.been.called()
          })
      })

      describe('if user consent has been previously saved', () => {
        it('should have marked the request as successful', () => {
          let request = LoginConsentRequest.from(opAuthRequest)

          request.checkSavedConsentFor = sinon.mock()
            .returns(Promise.resolve(true))

          return LoginConsentRequest.obtainConsent(request)
            .then(opAuthRequest => {
              expect(opAuthRequest.consent).to.be.true()
              expect(opAuthRequest.scope).to.equal('openid')
            })
        })

        it('should not have called renderConsentPage()', () => {

        })
      })

      describe('if user consent has NOT been previously saved', () => {
        it('should call renderConsentPage()', () => {
          let request = LoginConsentRequest.from(opAuthRequest)

          request.checkSavedConsentFor = sinon.mock()
            .returns(Promise.resolve(false))
          request.response.render = sinon.mock()

          let renderConsentPage = sinon.spy(request, 'renderConsentPage')

          return LoginConsentRequest.obtainConsent(request)
            .then(() => {
              expect(renderConsentPage).to.have.been.called()
            })
        })

        it('should not have marked success', () => {
          let request = LoginConsentRequest.from(opAuthRequest)

          request.checkSavedConsentFor = sinon.mock()
            .returns(Promise.resolve(false))
          request.response.render = sinon.mock()

          return LoginConsentRequest.obtainConsent(request)
            .then(opAuthRequest => {
              expect(opAuthRequest.consent).to.not.exist()
              expect(opAuthRequest.scope).to.not.exist()
            })
        })
      })
    })
  })

  describe('renderConsentPage()', () => {
    it('should call res.render', () => {
      let req = { body: {} }
      let res = HttpMocks.createResponse()

      let render = sinon.stub(res, 'render')

      let opAuthRequest = { req, res }
      let request = LoginConsentRequest.from(opAuthRequest)

      return LoginConsentRequest.obtainConsent(request)
        .then(() => {
          expect(render).to.have.been.calledWith('auth/consent')
        })
    })

    it('should set the headerSent property on opAuthRequest', () => {
      let req = { body: {} }
      let res = HttpMocks.createResponse()

      sinon.stub(res, 'render')

      let opAuthRequest = { req, res }
      let request = LoginConsentRequest.from(opAuthRequest)

      request.checkSavedConsentFor = sinon.mock()
        .returns(Promise.resolve(false))

      return LoginConsentRequest.obtainConsent(request)
        .then(opAuthRequest => {
          expect(opAuthRequest.headersSent).to.be.true()
        })
    })
  })
})
