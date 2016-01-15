/**
 * A simple unifile server to expose unifile api and nothing else
 * https://github.com/silexlabs/unifile/
 * license: GPL v2
 */
// node modules
var express = require('express');
var app = express();
var Unifile = require('../lib/');
var request = require('request');
var unifile = new Unifile();
var bodyParser = require('body-parser');

app.use( bodyParser.json() );

// Fake connector
var connector = {
  // Name is mandatory
  name: 'FakeGH',
  // Implement all the functions you'd like on your connector
  authorize: function(){
    request('https://github.com/login/oauth/authorize?scope=repo,delete_repo&client_id=c39806c4d0906cfeaac932012996a1919475cc78', function authorizeCallback(req, res, body) {
      console.log('return', body);
    });
  }
};

// Register connector
unifile.useConnector(connector);

// use unifile as a middleware
app.post('/authorize', function(req, res) {
  console.log('Request');
  //unifile.authorize(connector.name);
  res.end('OK');
});

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});
