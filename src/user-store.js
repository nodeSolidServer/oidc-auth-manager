'use strict'

const KVPFileStore = require('kvplus-files')
const bcrypt = require('bcrypt')

const DEFAULT_SALT_ROUNDS = 10

class UserStore {
  /**
   * @constructor
   *
   * @param [options={}] {Object} Options hashmap
   * @param [options.path] {string} Directory path where the various collections
   *   (users etc) will be stored.
   *
   * @param [options.saltRounds] {number} Number of `bcrypt` password hash
   *   salt rounds.
   * @see https://www.npmjs.com/package/bcrypt
   *
   * @param [options.backend] {KVPFileStore} Optional Key/Value file store
   *   (will be initialized if not passed in).
   * @see https://github.com/solid/kvplus-files
   */
  constructor (options = {}) {
    this.backend = options.backend
    this.saltRounds = options.saltRounds
  }

  /**
   * Factory method, constructs a UserStore instance from passed in options.
   * Usage:
   *
   *   ```
   *   let options = {
   *     path: './db',
   *     saltRounds: 10
   *   }
   *   let store = UserStore.from(options)
   *   ```
   *
   * @param [options={}] {Object} Options hashmap
   * @param [options.backend] {KVPFileStore} Optional Key/Value file store
   *   (will be initialized if not passed in).
   * @param [options.path] {string} Directory path where the various collections
   *   (users etc) will be stored. Used to initialize a backend if it's not
   *   explicitly passed in.
   * @param [options.saltRounds] {number} Number of `bcrypt` password hash
   *   salt rounds.
   *
   * @returns {UserStore}
   */
  static from (options = {}) {
    options.saltRounds = options.saltRounds || DEFAULT_SALT_ROUNDS

    if (!options.backend) {
      let storeOptions = UserStore.backendOptionsFor(options.path)
      options.backend = new KVPFileStore(storeOptions)
    }

    return new UserStore(options)
  }

  /**
   * Constructs and returns options for initializing a default KVPFileStore
   * instance.
   *
   * @param path {string} Directory path where the various collections
   *   (users etc) will be stored. Used to initialize a backend if it's not
   *   explicitly passed in.
   *
   * @return {Object}
   */
  static backendOptionsFor (path) {
    return {
      path,
      collections: ['users', 'users-by-email']
    }
  }

  /**
   * Creates and returns an fs-safe filename key from an email.
   *
   * @param email {string|null}
   *
   * @return {string|null}
   */
  static normalizeEmailKey (email) {
    if (!email) { return null }

    return encodeURIComponent(email)
  }

  /**
   * Creates and returns an fs-safe filename key from an id string (which can
   * be an http URI).
   *
   * @param id {string|null}
   *
   * @return {string|null}
   */
  static normalizeIdKey (id) {
    if (!id) { return null }

    return encodeURIComponent(id)
  }

  /**
   * Initializes the backend store's collections (if using a file-system based
   * backend, this creates directories for each collection).
   */
  initCollections () {
    this.backend.initCollections()
  }

  /**
   * Generates a salted password hash, saves user credentials to the 'users'
   * collection, and makes an index entry into the 'users-by-email' collection
   * if applicable.
   *
   * @param user {UserAccount} User account currently being created
   * @param password {string} User's login password
   *
   * @throws {TypeError} HTTP 400 errors if required parameters are missing.
   *
   * @return {Promise<Object>} Resolves to stored user object hashmap
   */
  createUser (user, password) {
    if (!user || !user.id) {
      let error = new TypeError('No user id provided to user store')
      error.status = 400
      return Promise.reject(error)
    }
    if (!password) {
      let error = new TypeError('No password provided')
      error.status = 400
      return Promise.reject(error)
    }

    return this.hashPassword(password)
      .then(hashedPassword => {
        user.hashedPassword = hashedPassword

        return this.saveUser(user)
      })
      .then(() => {
        return this.saveUserByEmail(user)
      })
  }

  /**
   * Saves a serialized user object to the 'users' collection.
   *
   * @param user {UserAccount}
   *
   * @return {Promise}
   */
  saveUser (user) {
    let userKey = UserStore.normalizeIdKey(user.id)
    return this.backend.put('users', userKey, user)
  }

  /**
   * Creates an entry for the user id in the 'users-by-email' index, if
   * applicable.
   *
   * @param user {UserAccount}
   *
   * @return {Promise}
   */
  saveUserByEmail (user) {
    if (user.email) {
      let userByEmail = { id: user.id }
      let key = UserStore.normalizeEmailKey(user.email)
      return this.backend.put('users-by-email', key, userByEmail)
    } else {
      return Promise.resolve()
    }
  }

  /**
   * Loads and returns a user object for a given id.
   *
   * @param userId {string}
   *
   * @return {Object} User info, parsed from a JSON string
   */
  findUser (userId) {
    let userKey = UserStore.normalizeIdKey(userId)
    return this.backend.get('users', userKey)
  }

  /**
   * Creates and returns a salted password hash, for storage with the user
   * record.
   *
   * @see https://www.npmjs.com/package/bcrypt
   *
   * @param plaintextPassword {string}
   *
   * @throws {Error}
   *
   * @return {Promise<string>} Combined salt and password hash, bcrypt style
   */
  hashPassword (plaintextPassword) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(plaintextPassword, this.saltRounds, (err, hashedPassword) => {
        if (err) { return reject(err) }
        resolve(hashedPassword)
      })
    })
  }

  /**
   * Returns the user object if the plaintext password matches the stored hash,
   * and returns a `null` if there is no match.
   *
   * @param user {UserAccount}
   * @param user.hashedPassword {string} Created by a previous call to
   *   `hashPassword()` and stored in the user object.
   *
   * @param plaintextPassword {string} For example, submitted by a user from a
   *   login form.
   *
   * @return {Promise<UserAccount|null>}
   */
  matchPassword (user, plaintextPassword) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(plaintextPassword, user.hashedPassword, (err, res) => {
        if (err) { return reject(err) }
        if (res) { // password matches
          return resolve(user)
        }
        return resolve(null)
      })
    })
  }
}

module.exports = UserStore
module.exports.DEFAULT_SALT_ROUNDS = DEFAULT_SALT_ROUNDS
