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
 * uses chai and supertest
 * http://chaijs.com/
 */

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
    "admin": "admin"
}

// use unifile as a middleware
app.use(unifile.middleware(express, app, options));

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});

function getElementByProp(arr, name, val){
    for(idx in arr){
        //console.log('getElementByProp', idx, arr[idx][name], val);

        if (arr[idx][name]===val){
            return arr[idx];
        }
    }
    return null;
}

// test routes
var cookie;
describe('Test generic API routes', function() {
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
