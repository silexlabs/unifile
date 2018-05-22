'use strict';

const fs = require('fs');
const crypto = require('crypto');

const Unifile = require('../lib/');
const unifile = new Unifile();

const cipher = crypto.createCipher('aes192', 'a password');
const decipher = crypto.createDecipher('aes192', 'a password');

// Configure connectors
const dbxconnector = new Unifile.DropboxConnector({
	clientId: '37mo489tld3rdi2',
	clientSecret: 'kqfzd11vamre6xr',
	redirectUri: 'http://localhost:6805/dropbox/oauth-callback'
});

// Register connectors
unifile.use(dbxconnector);

const session = {};

// Register extensions
unifile.ext({
	onRead: (input) => {
		console.log(input.toString('utf8'));
		let decrypted = decipher.update(input.toString('utf8'), 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	},
	onWrite: (input) => {
		let encrypted = cipher.update(input, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		return encrypted;
	}
});

if(process.argv.length <= 2) {
	console.log('Usage: ' + __filename + ' FILE_PATH');
	process.exit(-1);
}

const param = process.argv[2];
const input = fs.readFileSync(param);

unifile.setAccessToken(session, 'dropbox', process.env.DROPBOX_TOKEN);

unifile.writeFile(session, 'dropbox', '/encrypted.txt', input)
.then(() => {
	return unifile.readFile(session, 'dropbox', '/encrypted.txt');
})
.then((content) => console.log(`Content is ${content}`));

