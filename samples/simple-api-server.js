/**
 * A simple unifile server to expose unifile api and nothing else
 * https://github.com/silexlabs/unifile/
 * license: GPL v2
 */
// node modules
var express = require('express');
var app = express();
var unifile = require('../lib/');
var multipart = require('connect-multiparty');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');

// config
var options = unifile.defaultConfig;

// define users (login/password) wich will be authorized to access the www folder (read and write)
options.www.USERS = {
    "admin": "admin"
}

// enable open pages
// this is the ""self hosting mode"
// auth with Mozilla persona, choose a name and brose a folder on the server where unifile is installed and which is served as http(s)://the-unifile-server.com/chosen-name/ - this is an experimental feature which still has to be fine tuned
// here you can set all open pages config, see default-config.js
options.openPages.ENABLED = true;


// parse data for file upload
app.use(options.apiRoot, multipart());

// parse data for post data
app.use(options.apiRoot, bodyParser.urlencoded({
    extended: true
}));
app.use(options.apiRoot, bodyParser.json());

app.use(options.apiRoot, cookieParser());
app.use(options.apiRoot, session({
    name: options.cookieName,
    secret: options.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
    // TIP: you may want to add a session store here
    // so that unifile memorizes the users connexion data
    // into a database or file - e.g. https://www.npmjs.com/package/connect-fs2
}));

// use unifile as a middleware
app.use(unifile.middleware(express, app, options));

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});


/*
// catch all errors and prevent nodejs to crash, production mode
process.on('uncaughtException', function(err) {
    console.log  ('---------------------');
    console.error('---------------------', 'Caught exception: ', err, '---------------------');
    console.log  ('---------------------');
});
*/
