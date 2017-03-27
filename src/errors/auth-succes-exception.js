'use strict'

class AuthSuccessException extends Error {
  constructor (message) {
    super(message)

    this.handled = true
  }
}

module.exports = AuthSuccessException
