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
var serveStatic = require('serve-static');

app.use( bodyParser.json() );
app.use(serveStatic(__dirname+'/public', {index: 'index.html'}));

// Fake connector
var Connector = require('../lib/unifile-github.js');
var connector = new Connector({clientId: 'b4e46028bf36d871f68d', clientSecret: 'c39806c4d0906cfeaac932012996a1919475cc78', state: 'aaathub'});
// Register connector
unifile.useConnector(connector);

// Register connector methods
app.post('/:connector/authorize', function(req, res) {
  var result = unifile.getAuthorizeURL(req.params.connector);
  res.end(result);
});

// List files and folders
app.get(/\/(.*)\/ls\/(.*)/, function(req, res) {
  unifile.ls(req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    res.status(400).send(err);
  });
});

app.put(/\/(.*)\/mkdir\/(.*)/, function(req, res) {
  unifile.mkdir(req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    res.status(400).send(err);
  });
});

app.put(/\/(.*)\/put\/(.*)/, function(req, res) {
  unifile.put(req.params[0], '/' + req.params[1], req.body.content)
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    res.status(400).send(err);
  });
});

app.get(/\/(.*)\/get\/(.*)/, function(req, res) {
  unifile.get(req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    res.status(400).send(err);
  });
});

app.patch(/\/(.*)\/mv\/(.*)/, function(req, res) {
  unifile.mv(req.params[0], '/' + req.params[1], '/' + req.body.destination)
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    res.status(400).send(err);
  });
});

// register callback url
app.get('/oauth-callback', function(req, res) {
  unifile.login(connector.name, req.query)
  .then(function(){
    res.end();
  })
  .catch(function(err){
    res.status(500).send(err);
  });
});

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});
