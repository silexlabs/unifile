/*
 * Unifile, unified access to cloud storage services.
 * https://github.com/silexlabs/unifile/
 *
 * Copyright (c) Silex Labs
 * Unifile is available under the GPL license
 * http://www.silexlabs.org/silex/silex-licensing/
 */
/*
 * About this file
 *
 * This is a sample of a nodejs API server which uses unifile to expose cloud storage services as a REST API
 */
// node modules
var express = require('express');
var app = express();
var unifile = require('../lib/');

// config
var options = unifile.defaultConfig;

// define users (login/password) wich will be authorized to access the www folder (read and write)
options.www.users = {
    "admin": "admin"
};

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