'use strict';
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

const GitHubConnector = require('../lib/unifile-github.js');
const DropboxConnector = require('../lib/unifile-dropbox.js');
const FtpConnector = require('../lib/unifile-ftp.js');
const RSConnector = require('../lib/unifile-remoteStorage.js');
const ghconnector = new GitHubConnector({clientId: 'b4e46028bf36d871f68d', clientSecret: 'c39806c4d0906cfeaac932012996a1919475cc78', state: 'aaathub'});
const dbxconnector = new DropboxConnector({clientId: '37mo489tld3rdi2', clientSecret: 'kqfzd11vamre6xr', state: 'aaathub', redirectUri: 'http://localhost:6805/dropbox/oauth-callback'});
const ftpconnector = new FtpConnector({redirectUri: 'http://localhost:6805/ftp/signin'});
const rsconnector = new RSConnector({redirectUri: 'http://localhost:6805/remotestorage/callback'});
// Register connector
unifile.use(ghconnector);
unifile.use(dbxconnector);
unifile.use(ftpconnector);
unifile.use(rsconnector);

// Register connector methods
app.post('/:connector/authorize', function(req, res) {
  if(req.body != null){
    if(req.session.unifile.remotestorage)
      req.session.unifile.remotestorage.userAddress = req.body.userAddress;
    else
      req.session.unifile.remotestorage = req.body;
  }
  unifile.getAuthorizeURL(req.session.unifile, req.params.connector)
  .then(result => res.end(result));
});

// Search for a old session token in the cookies
app.get('/', function(req, res){
  // Init unifile session in Express
  req.session.unifile = req.session.unifile || {};

  let response;
  if(req.cookies.unifile_github)
    response = unifile.setAccessToken(req.session.unifile, 'github', req.cookies.unifile_github);
  if(req.cookies.unifile_dropbox)
    response = unifile.setAccessToken(req.session.unifile, 'dropbox', req.cookies.unifile_dropbox);

  if(response)
    response.then(() => res.sendFile(__dirname + '/public/index.html'));
  else res.sendFile(__dirname + '/public/index.html');
});

// List files and folders
app.get(/\/(.*)\/ls\/(.*)/, function(req, res) {
  unifile.readdir(req.session.unifile, req.params[0], req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.put(/\/(.*)\/mkdir\/(.*)/, function(req, res) {
  unifile.mkdir(req.session.unifile, req.params[0], req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.put(/\/(.*)\/put\/(.*)/, function(req, res) {
  unifile.writeFile(req.session.unifile, req.params[0], req.params[1], req.body.content)
  .then(function(result){
    console.log('res', result);
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.get(/\/(.*)\/get\/(.*)/, function(req, res) {
  unifile.readFile(req.session.unifile, req.params[0], req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.patch(/\/(.*)\/mv\/(.*)/, function(req, res) {
  unifile.rename(req.session.unifile, req.params[0], req.params[1], req.body.destination)
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.delete(/\/(.*)\/rm\/(.*)/, function(req, res) {
  unifile.unlink(req.session.unifile, req.params[0], req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.delete(/\/(.*)\/rmdir\/(.*)/, function(req, res) {
  unifile.rmdir(req.session.unifile, req.params[0], req.params[1])
  .then(function(result){
    res.send(result);
  })
  .catch(function(err){
    console.error(err);
    res.status(400).send(err);
  });
});

app.post(/\/(.*)\/cp\/(.*)/, function(req, res) {
  var read = unifile.createReadStream(req.session.unifile, req.params[0], req.params[1]);
  var write = unifile.createWriteStream(req.session.unifile, req.params[0], req.body.destination);
  read.pipe(write).pipe(res);
});

// register callback url
app.get('/:connector/oauth-callback', function(req, res) {
  unifile.login(req.session.unifile, req.params.connector, req.query)
  .then(function(result){
    res.cookie('unifile_' + req.params.connector, result);
    res.end('<script>window.close();</script>');
  })
  .catch(function(err){
    console.error('ERROR', err);
    res.status(500).send(err);
  });
});

app.get('/remotestorage/callback', function(req, res){
  // Return a script that get the hash and redirect to oauth-callback
  res.end('<script>var token = location.hash.substr(1).split("=")[1];location="/remotestorage/oauth-callback?token="+token</script>');
});

app.get('/ftp/signin', function(req, res){
  res.sendFile(__dirname + '/public/ftp_login.html');
});

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});
