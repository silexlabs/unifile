/*
 * Unifile, unified access to cloud storage services.
 * https://github.com/silexlabs/unifile/
 *
 * Copyright (c) Silex Labs
 * Unifile is available under the GPL license
 * http://www.silexlabs.org/silex/silex-licensing/
 */

/**
 * About this file
 *
 * functional tests
 * todo
 * * test errors (commands and auth)
 */
// test modules
var should = require('chai').should();
var supertest = require('supertest');
var api = supertest.agent('http://localhost:6805');
var InitTest = require('../init-unifile');
var options = InitTest.options;

/*
 * useful methode
 */
function getElementByProp(arr, name, val){
    for(idx in arr){
        if (arr[idx][name]===val){
            return arr[idx];
        }
    }
    return null;
}


// test routes
describe('Test www service', function() {
  before(function () {
    // define users (login/password) wich will be authorized to access the www folder (read and write)
    options.www.USERS = {
        "admin": "admin"
    }
  });
  // test auth error
  describe('Authentication error', function() {
    it('should logout', function(done) {
      api.get('/api/v1.0/www/logout/')
      .expect(200, done)
      .expect('Content-Type', /json/)
    });
    var authorize_url = options.www.AUTH_FORM_ROUTE;
    it('should connect and return the auth page url', function(done) {
        api.get('/api/v1.0/www/connect/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
            if (err) return done(err);
            console.log('/api/v1.0/www/connect/', res.body, typeof(res.body.authorize_url));
            res.body.should.have.property('authorize_url').and.be.a('string');
            authorize_url = res.body.authorize_url;
            done();
        });
    });
    it('should return the auth page HTML content', function(done) {
        api.get(authorize_url)
        .expect(200, done);
    });
    it('should NOT authorize', function(done) {
          api.post(options.www.AUTH_FORM_SUBMIT_ROUTE)
          .send({'username': 'wrong', 'password': 'password'})
          .expect(401)
          .end(function(err, res) {
            if (err) return done(err);
            done();
          });
    });
    it('should NOT be logged in', function(done) {
        api.get('/api/v1.0/www/login/')
        .expect(401, done)
        .expect('Content-Type', /json/);
    });
    it('should NOT have acces to account info', function(done) {
        api.get('/api/v1.0/www/account/')
        .expect(401, done)
        .expect('Content-Type', /json/);
    });
  });
  // test auth success
  describe('Authentication success', function() {
    it('should logout', function(done) {
      api.get('/api/v1.0/www/logout/')
      .expect(200, done)
      .expect('Content-Type', /json/)
    });
    var authorize_url = options.www.AUTH_FORM_ROUTE;
    it('should connect and return the auth page url', function(done) {
        api.get('/api/v1.0/www/connect/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
            if (err) return done(err);
            console.log('/api/v1.0/www/connect/', res.body, typeof(res.body.authorize_url));
            res.body.should.have.property('authorize_url').and.be.a('string');
            authorize_url = res.body.authorize_url;
            done();
        });
    });
    it('should return the auth page HTML content', function(done) {
        api.get(authorize_url)
        .expect(200, done);
    });
    it('should authorize and return auth page HTML content', function(done) {
          api.post(options.www.AUTH_FORM_SUBMIT_ROUTE)
          .send({'username': 'admin', 'password': 'admin'})
          .expect(200)
          .end(function(err, res) {
              if (err) return done(err);
              console.log(options.www.AUTH_FORM_SUBMIT_ROUTE);
              done();
          });
    });
    it('should now be logged in', function(done) {
        api.get('/api/v1.0/www/login/')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
  });
  describe('User account', function() {
    it('should display account info', function(done) {
        api.get('/api/v1.0/www/account/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
            if (err) return done(err);
            console.log(res.body, res.body.display_name, typeof(res.body.display_name));
            res.body.should.be.instanceof(Object);
            res.body.should.have.property('display_name').and.be.a('string');
            done();
        });
    });
  });
  describe('Commands', function() {
    // commands
    it('should be abble to execute command ls at root', function(done) {
        api.get('/api/v1.0/www/exec/ls/')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
    it('should create a folder', function(done) {
        api.get('/api/v1.0/www/exec/mkdir/tmp-test')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
    it('should list the created folder', function(done) {
        api.get('/api/v1.0/www/exec/ls/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
            if (err) return done(err);
            res.body.should.be.an('array');
            var element = getElementByProp(res.body, 'name', 'tmp-test');
            should.exist(element);
            done();
        });
    });
    it('should be abble to add a text file', function(done) {
        api.get('/api/v1.0/www/exec/put/tmp-test/test.txt:This is a text my file.')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
    it('should list the created files', function(done) {
        api.get('/api/v1.0/www/exec/ls/tmp-test/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
            if (err) return done(err);
            res.body.should.be.an('array');
            var element = getElementByProp(res.body, 'name', 'test.txt');
            should.exist(element);
            done();
        });
    });
    it('should copy the file', function(done) {
        api.get('/api/v1.0/www/exec/cp/tmp-test/test.txt:/tmp-test/test-cp.txt')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
    it('should list the created files', function(done) {
        api.get('/api/v1.0/www/exec/ls/tmp-test/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
            if (err) return done(err);
            res.body.should.be.an('array');
            var element = getElementByProp(res.body, 'name', 'test-cp.txt');
            should.exist(element);
            done();
        });
    });
    it('should rename (mv) a file', function(done) {
        api.get('/api/v1.0/www/exec/mv/tmp-test/test-cp.txt:/tmp-test/test-mv.txt')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
    it('should list the created files', function(done) {
        api.get('/api/v1.0/www/exec/ls/tmp-test/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          console.log('ls : ', res.body);
            if (err) return done(err);
            res.body.should.be.an('array');
            var element = getElementByProp(res.body, 'name', 'test-mv.txt');
            should.exist(element);
            var element = getElementByProp(res.body, 'name', 'test-cp.txt');
            should.not.exist(element);
            done();
        });
    });
    it('should be abble to remove a file', function(done) {
        api.get('/api/v1.0/www/exec/rm/tmp-test/test-mv.txt')
        .expect(200, done)
        .expect('Content-Type', /json/);
    });
    it('should list the created files', function(done) {
        api.get('/api/v1.0/www/exec/ls/tmp-test/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
            if (err) return done(err);
            res.body.should.be.an('array');
            var element = getElementByProp(res.body, 'name', 'test.txt');
            should.exist(element);
            var element = getElementByProp(res.body, 'name', 'test-mv.txt');
            should.not.exist(element);
             done();
        });
    });
    it('should retrieve the content of a text file', function(done) {
        api.get('/api/v1.0/www/exec/get/tmp-test/test.txt')
        .expect(200)
        .expect('Content-Type', /text/)
        .end(function (err, res) {
            if (err) return done(err);
            res.text.should.be.a('string');
            res.text.should.equal('This is a text my file.');
            done();
        });
    });
  });
  // cleanup after commands test
  after(function () {
    console.log('cleanup');
    var fs = require('fs'), pathModule = require('path');

    var resolvedPath = pathModule.resolve(__dirname, '../../www/tmp-test/test.txt');
    if (fs.existsSync(resolvedPath))
        fs.unlinkSync(resolvedPath);
    var resolvedPath = pathModule.resolve(__dirname, '../../www/tmp-test/test-cp.txt');
    if (fs.existsSync(resolvedPath))
        fs.unlinkSync(resolvedPath);
    var resolvedPath = pathModule.resolve(__dirname, '../../www/tmp-test/test-mv.txt');
    if (fs.existsSync(resolvedPath))
        fs.unlinkSync(resolvedPath);
    var resolvedPath = pathModule.resolve(__dirname, '../../www/tmp-test');
    if (fs.existsSync(resolvedPath))
        fs.rmdirSync(resolvedPath);
    console.log('end tests');
  });
});
