// init tested module
var unifile = require('../lib/');

// node modules
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var multipart = require('connect-multiparty');


// init express
var app = express();

// config
var options = exports.options = unifile.defaultConfig;

// parse data for file upload
app.use(options.apiRoot, multipart());

// parse data for post and get requests
app.use(options.apiRoot, bodyParser.urlencoded({
    extended: true
}));
app.use(options.apiRoot, bodyParser.json());
app.use(options.apiRoot, cookieParser());

// session management
app.use(options.apiRoot, session({
    secret: options.sessionSecret,
    resave: false,
    saveUninitialized: false
}));

// use unifile as a middleware
app.use(unifile.middleware(express, app, options));

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Start tests on port ' + port);
});

