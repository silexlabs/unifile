// http://strongloop.com/strongblog/how-to-test-an-api-with-node-js/
// http://chaijs.com/
console.log('start tests');

// node modules
var express = require('express')
    , app = express()
    , should = require('chai').should()
    , supertest = require('supertest')
    , api = supertest('http://localhost:6805')
    , unifile = require('../lib/');

// config
var options = unifile.defaultConfig;

// define users (login/password) wich will be authorized to access the www folder (read and write)
options.www.users = {
    "abcd": "1234"
    , "efgh": "5678"
}

// use unifile as a middleware
app.use(unifile.middleware(express, app, options));

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});

var cookie;
describe('General routes', function() {
  it('should display services', function(done) {
    api.get('/api/v1.0/services/list/')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(function(err, res) {
        if (err) return done(err);
        console.log(res.body, res.body.display_name, typeof(res.body.display_name));
        res.body.should.be.instanceof(Array);
        res.body[0].should.have.property('display_name').and.be.a('string');
        done();
    });
  });
});
describe('Authentication', function() {
  it('should logout', function(done) {
    api.get('/api/v1.0/www/logout/')
    .expect(200, done)
    .expect('Content-Type', /json/)
  });
  var authorize_url = options.www.auth_form_route;
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
        api.post(options.www.auth_form_submit_route)
        .send({'username': 'abcd', 'password': '1234'})
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            console.log(options.www.auth_form_submit_route);
            cookie = res.headers['set-cookie'];
            done();
        });
  });
  it('should now be logged in', function(done) {
      api.get('/api/v1.0/www/login/')
      .set('cookie', cookie)
      .expect(200, done)
      .expect('Content-Type', /json/);
  });
});
describe('User account', function() {
    it('should display account info', function(done) {
        api.get('/api/v1.0/www/account/')
        .expect(200)
        .expect('Content-Type', /json/)
        .set('cookie', cookie)
        .end(function(err, res) {
            if (err) return done(err);
            console.log(res.body, res.body.display_name, typeof(res.body.display_name));
            res.body.should.be.instanceof(Object);
            res.body.should.have.property('display_name').and.be.a('string');
            done();
        });
    });
});

/*
describe('Authentication', function() {
  it('errors if wrong basic auth', function(done) {
    api.post('/api/v1.0/www/login/', {'username': 'abcd', 'password': '1234'})
    .set('x-api-key', '123myapikey')
    .auth('incorrect', 'credentials')
    .expect(401, done)
  });
});
*/