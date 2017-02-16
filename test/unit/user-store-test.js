'use strict'

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()

const UserStore = require('../../src/user-store')

describe('UserStore', () => {
  describe('backendOptionsFor()', () => {
    it('should return a backend options object', () => {
      let path = './db'
      let options = UserStore.backendOptionsFor(path)

      expect(options.path).to.equal(path)
      expect(options.collections).to.deep.equal(['users', 'users-by-email'])
    })
  })

  describe('from()', () => {
    it('should initialize a UserStore instance from options', () => {
      let path = './db'
      let options = { path }

      let store = UserStore.from(options)

      expect(store.saltRounds).to.equal(UserStore.DEFAULT_SALT_ROUNDS)
      expect(store.backend.path).to.equal(path)
      expect(store.backend).to.respondTo('put')
    })
  })

  describe('normalizeEmailKey()', () => {
    it('should return a null if no email is passed in', () => {
      let key = UserStore.normalizeEmailKey(null)
      expect(key).to.be.null
    })

    it('should uri-escape an email that is passed in', () => {
      let key = UserStore.normalizeEmailKey('alice@example.com')
      expect(key).to.equal('alice%40example.com')
    })
  })

  describe('normalizeIdKey()', () => {
    it('should return a null if no id is passed in', () => {
      let key = UserStore.normalizeIdKey(null)
      expect(key).to.be.null
    })

    it('should cast an integer id to string', () => {
      let key = UserStore.normalizeIdKey(10)
      expect(key).to.equal('10')
    })

    it('should uri-escape an email that is passed in', () => {
      let key = UserStore.normalizeIdKey('https://alice.example.com/#me')
      expect(key).to.equal('https%3A%2F%2Falice.example.com%2F%23me')
    })
  })

  describe('createUser()', () => {
    it('should throw an error if no user is provided', (done) => {
      let password = '12345'
      let store = UserStore.from({ path: './db' })

      store.createUser(null, password)
        .catch(error => {
          expect(error.message).to.equal('No user id provided to user store')
          done()
        })
    })

    it('should throw an error if no user id is provided', (done) => {
      let user = {}
      let password = '12345'
      let store = UserStore.from({ path: './db' })

      store.createUser(user, password)
        .catch(error => {
          expect(error.message).to.equal('No user id provided to user store')
          done()
        })
    })

    it('should throw an error if no password is provided', (done) => {
      let user = { id: 'abc' }
      let store = UserStore.from({ path: './db' })

      store.createUser(user, null)
        .catch(error => {
          expect(error.message).to.equal('No password provided')
          done()
        })
    })

    it('should create a hashed password', () => {
      let user = { id: 'abc' }
      let password = '12345'
      let store = UserStore.from({ path: './db' })

      store.backend.put = sinon.stub().returns(Promise.resolve())
      store.hashPassword = sinon.spy(store, 'hashPassword')

      return store.createUser(user, password)
        .then(() => {
          expect(store.hashPassword).to.have.been.calledWith(password)
        })
    })

    it('should save the user record', () => {
      let user = { id: 'abc' }
      let password = '12345'
      let store = UserStore.from({ path: './db' })

      store.backend.put = sinon.stub().returns(Promise.resolve())
      store.saveUser = sinon.spy(store, 'saveUser')

      return store.createUser(user, password)
        .then(() => {
          expect(store.saveUser).to.have.been.calledWith(user)
        })
    })

    it('should create an entry in the users-by-email index', () => {
      let user = { id: 'abc', email: 'alice@example.com' }
      let password = '12345'
      let store = UserStore.from({ path: './db' })

      store.backend.put = sinon.stub().returns(Promise.resolve())
      store.saveUserByEmail = sinon.spy(store, 'saveUserByEmail')

      return store.createUser(user, password)
        .then(() => {
          expect(store.saveUserByEmail).to.have.been.calledWith(user)
        })
    })
  })
})
