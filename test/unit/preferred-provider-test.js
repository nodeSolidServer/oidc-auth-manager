'use strict'

const provider = require('../../src/preferred-provider')

const nock = require('nock')
const chai = require('chai')
// const sinon = require('sinon')
chai.use(require('dirty-chai'))
// const sinonChai = require('sinon-chai')
// chai.use(sinonChai)
const expect = chai.expect
const serverUri = 'https://example.com'

describe('preferred-provider.js', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('discoverProviderFor()', () => {
    const webId = 'https://example.com/#me'

    it('should extract and validate the provider uri from link rel header', () => {
      nock(serverUri)
        .options('/')
        .reply(204, 'No content', {
          'Link': '<https://example.com>; rel="http://openid.net/specs/connect/1.0/issuer"'
        })

      let webId = 'https://example.com/#me'

      return provider.discoverProviderFor(webId)
        .then(providerUri => {
          expect(providerUri).to.equal('https://example.com')
        })
    })

    it('should throw an error if provider returns no link rel header', done => {
      nock(serverUri)
        .options('/')
        .reply(204, 'No content')

      provider.discoverProviderFor(webId)
        .catch(err => {
          expect(err.message).to.include('OIDC issuer not advertised')
          done()
        })
    })

    it('should throw an error if provider is unreachable', done => {
      nock(serverUri)
        .options('/')
        .reply(404)

      provider.discoverProviderFor(webId)
        .catch(err => {
          expect(err.statusCode).to.equal(400)
          expect(err.message).to.include('Provider not found')
          done()
        })
    })
  })

  describe('validateProviderUri()', () => {
    it('throws a 400 on an invalid provider uri', done => {
      try {
        provider.validateProviderUri('invalid provider uri')
      } catch (error) {
        expect(error.statusCode).to.equal(400)
        expect(error.message).to.include('not a valid URI')
        done()
      }
    })
  })

  describe('providerExists()', () => {
    it('should return the provider uri if oidc config exists there', () => {
      nock(serverUri)
        .head('/.well-known/openid-configuration')
        .reply(200)

      return provider.providerExists(serverUri + '/whatever')
        .then(result => {
          expect(result).to.equal(serverUri)
        })
    })

    it('should return null if no oidc capability exists', () => {
      nock(serverUri)
        .head('/.well-known/openid-configuration')
        .reply(404)

      return provider.providerExists(serverUri + '/whatever')
        .then(result => {
          expect(result).to.be.null()
        })
    })
  })

  describe('preferredProviderFor()', () => {
    it('should return the provider uri if oidc provider exists at webid', () => {
      nock('https://example.com')
        .head('/.well-known/openid-configuration')
        .reply(200)

      const webId = 'https://example.com/profile#me'

      return provider.preferredProviderFor(webId)
        .then(providerUri => {
          expect(providerUri).to.equal('https://example.com')
        })
    })

    it('should discover preferred provider if no oidc capability at webid', () => {
      nock('https://example.com')
        .head('/.well-known/openid-configuration')
        .reply(404)

      nock('https://example.com')
        .options('/profile')
        .reply(204, 'No content', {
          'Link': '<https://provider.com>; rel="http://openid.net/specs/connect/1.0/issuer"'
        })

      const webId = 'https://example.com/profile#me'

      return provider.preferredProviderFor(webId)
        .then(providerUri => {
          expect(providerUri).to.equal('https://provider.com')
        })
    })
  })
})
