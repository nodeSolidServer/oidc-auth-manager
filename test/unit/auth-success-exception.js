'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
chai.should()
const expect = chai.expect

const AuthSuccessException = require('../../src/errors/auth-succes-exception')

describe('AuthSuccessException', () => {
  it('should create a handled error', () => {
    let authSuccess = new AuthSuccessException()

    expect(authSuccess.handled).to.be.true()
  })
})
