'use strict'

const fs = require('fs-extra')
const path = require('path')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
chai.should()

const UserStore = require('../../src/user-store')
const dbPath = './test/db'

describe('UserStore (integration)', () => {
  beforeEach(() => {
    fs.removeSync(dbPath)
  })

  afterEach(() => {
    fs.removeSync(dbPath)
  })

  describe('initCollections()', () => {
    it('should create collection directories in db path', () => {
      let options = { path: dbPath }
      let store = UserStore.from(options)

      store.initCollections()

      expect(fs.existsSync(path.join(dbPath, 'users'))).to.be.true
      expect(fs.existsSync(path.join(dbPath, 'users-by-email'))).to.be.true
    })
  })

  describe('createUser()', () => {
    it('should create a user record and relevant index entries', () => {
      let options = { path: dbPath }
      let store = UserStore.from(options)
      store.initCollections()

      let user = {
        id: 'alice.example.com',
        email: 'alice@example.com'
      }
      let password = '12345'

      return store.createUser(user, password)
        .then(createdUser => {
          expect(createdUser.password).to.not.exist
          expect(createdUser.hashedPassword).to.not.exist

          let userFileName = store.backend.fileNameFor(user.id)
          let userFilePath = path.join(dbPath, 'users', userFileName)
          expect(fs.existsSync(userFilePath)).to.be.true

          let emailIndexFile = store.backend.fileNameFor('alice%40example.com')
          let emailIndexPath = path.join(dbPath, 'users-by-email', emailIndexFile)
          console.log(emailIndexPath)
          expect(fs.existsSync(emailIndexPath)).to.be.true
        })
    })
  })
})
