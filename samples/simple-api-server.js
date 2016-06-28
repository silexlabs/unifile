/**
 * A simple unifile server to expose unifile api and nothing else
 * https://github.com/silexlabs/unifile/
 * license: GPL v2
 */
// node modules
const express = require('express');
const app = express();
const Unifile = require('../lib/');
const request = require('request');
const unifile = new Unifile();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const serveStatic = require('serve-static');
const session = require('express-session');

app.use( bodyParser.json() );
app.use(cookieParser());
app.use(session({
  secret: 'unifile',
  resave: false,
  saveUninitialized: false
}));
//app.use(serveStatic(__dirname+'/public', {index: 'index.html'}));

// Fake connector
const Connector = require('../lib/unifile-github.js');
const connector = new Connector({clientId: 'b4e46028bf36d871f68d', clientSecret: 'c39806c4d0906cfeaac932012996a1919475cc78', state: 'aaathub'});
// Register connector
unifile.use(connector);

// Register connector methods
app.post('/:connector/authorize', function(req, res) {
  var result = unifile.getAuthorizeURL(req.session.unifile, req.params.connector);
  res.end(result);
});

// Search for a old session token in the cookies
app.get('/', function(req, res){
  // Init unifile session in Express
  req.session.unifile = req.session.unifile || {};

  let response;
  if(req.cookies.unifileToken)
    response = unifile.setAccessToken(req.session.unifile, 'github', req.cookies.unifileToken)
  else
    response = unifile.clearAccessToken(req.session.unifile, 'github');

  response.then(() => res.sendFile(__dirname + '/public/index.html'));
});

// List files and folders
app.get(/\/(.*)\/ls\/(.*)/, function(req, res) {
  unifile.readdir(req.session.unifile, req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.put(/\/(.*)\/mkdir\/(.*)/, function(req, res) {
  unifile.mkdir(req.session.unifile, req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.put(/\/(.*)\/put\/(.*)/, function(req, res) {
  unifile.writeFile(req.session.unifile, req.params[0], '/' + req.params[1], req.body.content)
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.get(/\/(.*)\/get\/(.*)/, function(req, res) {
  unifile.readFile(req.session.unifile, req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.patch(/\/(.*)\/mv\/(.*)/, function(req, res) {
  unifile.rename(req.session.unifile, req.params[0], '/' + req.params[1], '/' + req.body.destination)
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.delete(/\/(.*)\/rm\/(.*)/, function(req, res) {
  unifile.unlink(req.session.unifile, req.params[0], '/' + req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.post(/\/(.*)\/cp\/(.*)/, function(req, res) {
  var read = unifile.createReadStream(req.session.unifile, req.params[0], '/' + req.params[1]);
  var write = unifile.createWriteStream(req.session.unifile, req.params[0], '/' + req.body.destination);
  read.pipe(write).pipe(res);
});

// register callback url
app.get('/oauth-callback', function(req, res) {
  unifile.login(req.session.unifile, connector.name, req.query)
  .then(function(result){
    res.cookie('unifileToken', result);
    res.end('<script>window.close();</script>');
  })
  .catch(function(err){
    console.error(err);
    res.status(500).send(err);
  });
});

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});
