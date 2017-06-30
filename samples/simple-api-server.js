'use strict';

const Path = require('path');
const PassThrough = require('stream').PassThrough;

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const Unifile = require('../lib/');

const app = express();
const unifile = new Unifile();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
	secret: 'unifile',
	resave: false,
	saveUninitialized: false
}));

// Configure connectors
const ghconnector = new Unifile.GitHubConnector({
	clientId: 'b4e46028bf36d871f68d',
	clientSecret: 'c39806c4d0906cfeaac932012996a1919475cc78'
});
const dbxconnector = new Unifile.DropboxConnector({
	clientId: '37mo489tld3rdi2',
	clientSecret: 'kqfzd11vamre6xr',
	redirectUri: 'http://localhost:6805/dropbox/oauth-callback'
});
const ftpconnector = new Unifile.FtpConnector({redirectUri: 'http://localhost:6805/ftp/signin'});
const wdconnector = new Unifile.WebDavConnector({redirectUri: 'http://localhost:6805/webdav/signin'});
const rsconnector = new Unifile.RemoteStorageConnector({redirectUri: 'http://localhost:6805/remotestorage/callback'});
const fsconnector = new Unifile.FsConnector({showHiddenFile: true});
const sftpconnector = new Unifile.SftpConnector({redirectUri: 'http://localhost:6805/sftp/signin'});

// Register connectors
unifile.use(ghconnector);
unifile.use(dbxconnector);
unifile.use(ftpconnector);
unifile.use(rsconnector);
unifile.use(wdconnector);
unifile.use(fsconnector);
unifile.use(sftpconnector);

// Expose connector methods
app.post('/:connector/authorize', function(req, res) {
	if(req.body != null) {
		if(req.session.unifile.remotestorage)
			req.session.unifile.remotestorage.userAddress = req.body.userAddress;
		else
			req.session.unifile.remotestorage = req.body;
	}
	unifile.getAuthorizeURL(req.session.unifile, req.params.connector)
	.catch((err) => {
		console.error('Error while authorizing Unifile', err);
		res.statusCode = 400;
		res.end();
	})
	.then((result) => res.end(result));
});

// Search for a old session token in the cookies
app.get('/', function(req, res) {
	// Init unifile session in Express
	req.session.unifile = req.session.unifile || {};

	let response;
	if(req.cookies.unifile_github)
		response = unifile.setAccessToken(req.session.unifile, 'github', req.cookies.unifile_github);
	if(req.cookies.unifile_dropbox)
		response = unifile.setAccessToken(req.session.unifile, 'dropbox', req.cookies.unifile_dropbox);

	if(response)
		response.then(() => res.sendFile(Path.join(__dirname, 'public', 'index.html')));
	else res.sendFile(Path.join(__dirname, 'public', 'index.html'));
});

// List files and folders
app.get(/\/(.*)\/ls\/(.*)/, function(req, res) {
	unifile.readdir(req.session.unifile, req.params[0], req.params[1])
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.put(/\/(.*)\/mkdir\/(.*)/, function(req, res) {
	unifile.mkdir(req.session.unifile, req.params[0], req.params[1])
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.put(/\/(.*)\/put\/(.*)/, function(req, res) {
	unifile.writeFile(req.session.unifile, req.params[0], req.params[1], req.body.content)
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.get(/\/(.*)\/get\/(.*)/, function(req, res) {
	unifile.readFile(req.session.unifile, req.params[0], req.params[1])
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.patch(/\/(.*)\/mv\/(.*)/, function(req, res) {
	unifile.rename(req.session.unifile, req.params[0], req.params[1], req.body.destination)
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.delete(/\/(.*)\/rm\/(.*)/, function(req, res) {
	unifile.unlink(req.session.unifile, req.params[0], req.params[1])
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.delete(/\/(.*)\/rmdir\/(.*)/, function(req, res) {
	unifile.rmdir(req.session.unifile, req.params[0], req.params[1])
	.then(function(result) {
		res.send(result);
	})
	.catch(function(err) {
		console.error(err);
		res.status(400).send(err);
	});
});

app.post(/\/(.*)\/cp\/(.*)/, function(req, res) {
	let stream = unifile.createReadStream(req.session.unifile, req.params[0], req.params[1]);
	// Use PassThrough to prevent request from copying headers between requests
	if(req.params[0] !== 'webdav' && req.params[0] !== 'fs') stream = stream.pipe(new PassThrough());
	stream.pipe(unifile.createWriteStream(req.session.unifile, req.params[0], req.body.destination))
	.pipe(res);
});

app.post(/\/(.*)\/batch\/(.*)/, function(req, res) {
	const path = req.params[1];
	const batch = [
		{name: 'mkdir', path: path},
		{name: 'writeFile', path: path + '/test.txt', content: 'Hello world'},
		{name: 'writeFile', path: path + '/test2.txt', content: 'Hello world too'},
		{name: 'rename', path: path + '/test.txt', destination: path + '/test_old.txt'},
		{name: 'unlink', path: path + '/test2.txt'},
		{name: 'rmdir', path: path}
	];
	unifile.batch(req.session.unifile, req.params[0], batch)
	.then((result) => {
		res.send(result);
	})
	.catch((err) => {
		console.error(err);
		res.status(400).send(err);
	});
});

app.get(/\/(.*)\/stat\/(.*)/, function(req, res) {
	unifile.stat(req.session.unifile, req.params[0], req.params[1])
	.then((result) => {
		res.send(result);
	})
	.catch((err) => {
		res.status(400).send(err.message);
	});
});

// register callback url
app.get('/:connector/oauth-callback', function(req, res) {
	if('error' in req.query) {
		res.status(500).send(req.query);
	} else {
		unifile.login(req.session.unifile, req.params.connector, req.query)
		.then(function(result) {
			res.cookie('unifile_' + req.params.connector, result);
			res.end('<script>window.close();</script>');
		})
		.catch(function(err) {
			console.error('ERROR', err);
			res.status(500).send(err);
		});
	}
});

app.get('/remotestorage/callback', function(req, res) {
	// Return a script that get the hash and redirect to oauth-callback
	res.end('<script>' +
				'var token = location.hash.substr(1).split("=")[1];location="/remotestorage/oauth-callback?token="+token' +
				'</script>');
});

app.get('/:connector/signin', function(req, res) {
	res.sendFile(Path.join(__dirname, 'public', req.params.connector + '_login.html'));
});

// server 'loop'
const port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
	console.log('Listening on ' + port);
});
