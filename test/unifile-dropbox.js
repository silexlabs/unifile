'use strict';

const Url = require('url');
const chai = require('chai');
chai.use(require('chai-as-promised'));

const DropboxConnector = require('../lib/unifile-dropbox');
const {UnifileError} = require('../lib/error');

const expect = chai.expect;
chai.should();


// Shut up console logging
console.warn = function() {};

const dropboxDefaultInfos = {
	name: 'dropbox',
	displayName: 'Dropbox',
	icon: '../assets/dropbox.png',
	description: 'Edit files from your Dropbox.'
};

function isEnvValid() {
	return process.env.DROPBOX_SECRET && process.env.DROPBOX_TOKEN && process.env.DROPBOX_ACCOUNT;
}

function checkSession(session) {
	expect(session.token).to.exist;
	expect(session.account).to.exist;
	expect(session.account).to.have.all.keys('account_id', 'email', 'name');
}

describe('DropboxConnector', function() {
	this.timeout(9000);
	const session = {
		account: {id: process.env.DROPBOX_ACCOUNT}
	};
	const defaultConfig = {
		clientId: 'b4e46028bf36d871f68d',
		clientSecret: 'a',
		redirectUri: 'http://localhost:6805'
	};
	const authConfig = Object.assign({}, defaultConfig, {clientSecret: process.env.DROPBOX_SECRET});

	before('Init session with a valid account', function() {
		if(isEnvValid()) {
			return new DropboxConnector(authConfig)
			.setAccessToken(session, process.env.DROPBOX_TOKEN);
		}
	});

	describe('constructor', function() {
		it('throws an error with empty config', function() {
			expect(() => new DropboxConnector()).to.throw('Invalid configuration.');
		});

		it('throws an error without clientId', function() {
			expect(() => new DropboxConnector({clientSecret: 'a'})).to.throw('Invalid configuration.');
		});

		it('throws an error without clientSecret', function() {
			expect(() => new DropboxConnector({clientId: 'a'})).to.throw('Invalid configuration.');
		});

		it('overrides infos when given in config', function() {
			const overrides = {
				name: 'aaa',
				displayName: 'bbb',
				icon: 'ccc',
				description: 'dddd'
			};
			Object.keys(overrides).forEach((key) => {
				const config = {infos: {}, clientId: 'a', clientSecret: 'a', redirectUri: 'a'};
				config.infos[key] = overrides[key];
				const connector = new DropboxConnector(config);
				expect(connector).to.exist;
				Object.keys(connector.infos).forEach((info) => {
					if(info !== key)
						expect(connector.infos[info]).to.equal(dropboxDefaultInfos[info]);
					else
						expect(connector.infos[info]).to.equal(overrides[info]);
				});
				if(key === 'name')
					expect(connector.name).to.equal(overrides.name);
				else
					expect(connector.name).to.equal(dropboxDefaultInfos.name);
			});
		});

		it('ignores invalid infos', function() {
			const connector = new DropboxConnector({infos: 3, redirectUri: 'a', clientId: 'a', clientSecret: 'a'});
			expect(connector.infos).to.deep.equal(dropboxDefaultInfos);
		});
	});

	describe('getInfos()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new DropboxConnector(defaultConfig);
		});

		it('returns an infos object', function() {
			const infos = connector.getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(dropboxDefaultInfos.name);
			expect(infos.displayName).to.equal(dropboxDefaultInfos.displayName);
			expect(infos.icon).to.equal(dropboxDefaultInfos.icon);
			expect(infos.description).to.equal(dropboxDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.true;
			expect(infos.username).to.be.undefined;
		});

		it('returns a customed infos object is told so', function() {
			const infos = new DropboxConnector(Object.assign({}, defaultConfig, {infos: {icon: 'ooo'}, redirectUri: 'a'}))
			.getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(dropboxDefaultInfos.name);
			expect(infos.displayName).to.equal(dropboxDefaultInfos.displayName);
			expect(infos.icon).to.equal('ooo');
			expect(infos.description).to.equal(dropboxDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.true;
			expect(infos.username).to.be.undefined;
		});

		it('uses session account when available', function() {
			if(!isEnvValid()) this.skip();
			else {
				const infos = new DropboxConnector(authConfig).getInfos(session);
				expect(infos).to.be.an.instanceof(Object);
				expect(infos.name).to.equal(dropboxDefaultInfos.name);
				expect(infos.displayName).to.equal(dropboxDefaultInfos.displayName);
				expect(infos.icon).to.equal('../assets/dropbox.png');
				expect(infos.description).to.equal(dropboxDefaultInfos.description);
				expect(infos.isLoggedIn).to.be.true;
				expect(infos.isOAuth).to.be.true;
				expect(infos.username).to.equal('Jean-Baptiste RICHARDET');
			}
		});
	});

	describe('getAuthorizeURL()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new DropboxConnector(defaultConfig);
		});

		it('returns a promise for the authorization URL', function() {
			return connector.getAuthorizeURL({})
			.then((url) => {
				const authUrl = Url.parse(url, true);
				expect(authUrl.protocol).to.equal('https:');
				expect(authUrl.host).to.equal('www.dropbox.com');
				expect(authUrl.pathname).to.equal('/oauth2/authorize');
				expect(authUrl.query.response_type).to.equal('code');
				expect(authUrl.query.client_id).to.equal(defaultConfig.clientId);
				expect(authUrl.query.state).to.exist;
				expect(authUrl.query.redirect_uri).to.equal(defaultConfig.redirectUri);
			});
		});
	});

	describe('setAccessToken()', function() {
		before(function() {
			if(!isEnvValid()) this.skip();
		});

		let connector;
		beforeEach('Instanciation', function() {
			connector = new DropboxConnector(defaultConfig);
		});

		it('rejects the promise if the token credentials are wrong', function() {
			const token = 'Basic baaaad';
			const session = {};
			return connector.setAccessToken(session, token).should.be.rejectedWith('Bad credentials');
		});

		it('returns a promise of the token while setting it the session', function() {
			const token = process.env.DROPBOX_TOKEN;
			const session = {};
			return connector.setAccessToken(session, token)
			.then((t) => {
				expect(t).to.equal(token);
				expect(session.token).to.equal(token);
				checkSession(session);
			});
		});
	});

	describe('clearAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new DropboxConnector(defaultConfig);
		});

		it('returns an empty promise', function() {
			const session = {token: 'auaoeu', account: {login: 'oue'}};
			return connector.clearAccessToken(session)
			.then(() => {
				expect(session).to.be.empty;
			});
		});
	});

	describe('login()', function() {
		before(function() {
			if(!isEnvValid()) this.skip();
		});

		let connector;
		beforeEach('Instanciation', function() {
			connector = new DropboxConnector(authConfig);
		});

		it('rejects the promise with invalid login infos', function() {
			return expect(connector.login({}, {key: 'value'})).to.be.rejectedWith('Invalid credentials');
		});

		it('rejects the promise with malformed credentials', function() {
			return expect(connector.login({}, 'anything')).to.be.rejectedWith('Invalid credentials');
		});

		it('rejects the promise if states do not match', function() {
			return expect(connector.login({state: 'a'}, {state: 'b', code: '22'})).to.be.rejectedWith('cross-site request');
		});

		it('rejects the promise if the wrong login infos are provided', function() {
			const session = {state: 'a'};
			return connector.login(session, {state: 'a', code: '222'}).should.be.rejectedWith('Bad credentials');
		});
	});

	describe('readdir()', function() {
		let connector;
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_readdir'},
					{name: 'mkdir', path: 'unifile_readdir/test'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readdir(session, '/home')).to.be.rejectedWith('Not Found');
		});

		it('lists files in root', function() {
			return connector.readdir(session, '')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).is.above(0);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		it('lists files in the directory with proper entry infomations', function() {
			return connector.readdir(session, 'unifile_readdir')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.equal(1);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readdir');
			else this.skip();
		});
	});

	describe('stat()', function() {
		let connector;
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_stat'},
					{name: 'writeFile', path: 'unifile_stat/file1.txt', content: 'lorem ipsum'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is emtpy', function() {
			return expect(connector.stat(session, '')).to.be.rejectedWith('You must provide a path');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat(session, '/home')).to.be.rejectedWith('Not Found');
		});

		it('gives stats on a directory', function() {
			return connector.stat(session, 'unifile_stat')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		it('gives stats on a file', function() {
			return connector.stat(session, 'unifile_stat/file1.txt')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_stat');
			else this.skip();
		});
	});

	describe('mkdir()', function() {
		let connector;

		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_mkdir'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.mkdir(session, '')).to.be.rejectedWith('Cannot create dir with an empty name.');
		});

		it('rejects the promise if the folder path already exist', function() {
			return expect(connector.mkdir(session, 'unifile_mkdir')).to.be.rejectedWith('Creation failed due to conflict');
		});

		it('creates a new folder', function() {
			return connector.mkdir(session, 'aa')
			.then(() => {
				return expect(connector.readdir(session, 'aa')).to.be.fulfilled;
			})
			.then(() => {
				return connector.rmdir(session, 'aa');
			});
		});

		it('creates a new nested folder', function() {
			return connector.mkdir(session, 'unifile_mkdir/test')
			.then(() => {
				return expect(connector.readdir(session, 'unifile_mkdir/test')).to.be.fulfilled;
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_mkdir');
			else this.skip();
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_writeFile'},
					{name: 'writeFile', path: 'unifile_writeFile/file1.txt', content: 'lorem'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path already exist and no overwrite', function() {
			const noOverwriteConnector = new DropboxConnector(Object.assign({}, authConfig, {writeMode: 'add'}));
			return noOverwriteConnector.writeFile(session, 'unifile_writeFile/file1.txt', data)
			.should.be.rejectedWith('Creation failed due to conflict');
		});

		it('writes into a file', function() {
			return connector.writeFile(session, 'unifile_writeFile/testFile', data)
			.then(() => {
				return connector.readFile(session, 'unifile_writeFile/testFile');
			})
			.then((content) => {
				return expect(content.toString()).to.equal(data);
			})
			.then(() => {
				return connector.unlink(session, 'unifile_writeFile/testFile');
			});
		});

		it('overwrites a file if present', function() {
			return connector.writeFile(session, 'unifile_writeFile/file1.txt', data)
			.then(() => {
				return connector.readFile(session, 'unifile_writeFile/file1.txt');
			})
			.then((content) => {
				return expect(content.toString()).to.equal(data);
			})
			.then(() => {
				return connector.unlink(session, 'unifile_writeFile/file1.txt');
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_writeFile');
			else this.skip();
		});
	});

	describe('createWriteStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_writeStream'},
					{name: 'writeFile', path: 'unifile_writeStream/file1.txt', content: 'lorem'}
				]));
			} else this.skip();
		});

		it('emits an error if the path exists and no overwrite', function(done) {
			const noOverwriteConnector = new DropboxConnector(Object.assign({}, authConfig, {writeMode: 'add'}));
			const stream = noOverwriteConnector.createWriteStream(session, 'unifile_writeStream/file1.txt', data);
			stream.pipe(process.stdout);
			stream.on('error', (err) => {
				expect(err).to.be.an.instanceof(UnifileError);
				expect(err.message).to.equal('Creation failed');
				done();
			});
			stream.on('close', () => done(new Error('Did not error as planned')));
			stream.end(data);
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream(session, 'unifile_writeStream/testStream');
			// Wait for 'end' (not 'finish') to be sure it has been consumed
			stream.on('close', () => {
				return connector.readFile(session, 'unifile_writeStream/testStream')
				.then((result) => {
					expect(result.toString()).to.equal(data);
					done();
				})
				// Needed because the promise would catch the expect thrown exception
				.catch(done);
			});
			stream.on('error', done);
			stream.end(data);
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream(session, 'unifile_writeStream/file1.txt');
			// Wait for 'end' (not 'finish') to be sure it has been consumed
			stream.on('close', () => {
				return connector.readFile(session, 'unifile_writeStream/file1.txt')
				.then((result) => {
					expect(result.toString()).to.equal(data);
					done();
				})
				// Needed because the promise would catch the expect thrown exception
				.catch(done);
			});
			stream.on('error', done);
			stream.end(data);
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_writeStream');
			else this.skip();
		});
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';

		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_readFile'},
					{name: 'writeFile', path: 'unifile_readFile/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile(session, 'a/test/auoeuiqu')).to.be.rejectedWith('Not Found');
		});

		it('rejects the promise if the path is a directory', function() {
			return expect(connector.readFile(session, 'unifile_readFile')).to.be.rejectedWith('Path is a directory');
		});

		it('returns the content of a file', function() {
			return connector.readFile(session, 'unifile_readFile/file1.txt')
			.then((content) => {
				return expect(content.toString()).to.equal(data);
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readFile');
			else this.skip();
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';

		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_readstream'},
					{name: 'writeFile', path: 'unifile_readstream/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('throws an error if invalid credentials', function(done) {
			const stream = connector.createReadStream(Object.assign({}, session, {
				token: 'aoa'
			}), 'aouoeuoeu');
			stream.on('error', (err) => {
				expect(err.message).to.equal('Invalid request');
				done();
			});
			stream.on('data', () => {
				done(new Error('Should not emit this event'));
			});
		});

		it('throws an error if wrong credentials', function(done) {
			const stream = connector.createReadStream(Object.assign({}, session, {
				token: 'aoa'
			}), 'm-rHPgzYK6kAAAAAAAAJkc60_XzaSJikZrTaOHyzMgCuEtVmlTtpsQjLvjc8tr8L');
			stream.on('error', (err) => {
				expect(err.message).to.equal('Invalid request');
				done();
			});
			stream.on('data', () => {
				done(new Error('Should not emit this event'));
			});
		});

		it('throws an error if the path does not exist', function(done) {
			const stream = connector.createReadStream(session, 'aouoeuoeu');
			stream.on('error', (err) => {
				expect(err.message).to.equal('Not Found');
				done();
			});
			stream.on('data', (data) => {
				done(new Error('Should not emit this event'));
			});
		});

		it('throws an error if the path is a directory', function(done) {
			const stream = connector.createReadStream(session, 'unifile_readstream');
			stream.on('error', (err) => {
				expect(err.message).to.equal('Path is a directory');
				done();
			});
			stream.on('data', (data) => {
				done(new Error('Should not emit this event'));
			});
		});

		it('creates a readable stream', function(done) {
			const chunks = [];
			const stream = connector.createReadStream(session, 'unifile_readstream/file1.txt');
			stream.on('end', () => {
				expect(Buffer.concat(chunks).toString()).to.equal(data);
				done();
			});
			stream.on('error', done);
			stream.on('data', (content) => chunks.push(content));
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readstream');
			else this.skip();
		});
	});

	describe('rename()', function() {
		let connector;
		const data = 'lorem ipsum';
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_rename'},
					{name: 'mkdir', path: 'unifile_rename2'},
					{name: 'writeFile', path: 'unifile_rename/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.rename(session, '', 'home/test2'))
			.to.be.rejectedWith('Cannot rename path with an empty name');
		});

		it('rejects the promise if the destination is not provided', function() {
			return expect(connector.rename(session, 'unifile_rename'))
			.to.be.rejectedWith('Cannot rename path with an empty destination');
		});

		it('rejects the promise if one of the paths does not exist', function() {
			return expect(connector.rename(session, '/home/test', 'home/test2')).to.be.rejectedWith('Not Found');
		});

		it('renames a folder', function() {
			return connector.rename(session, 'unifile_rename2', 'unifile_rename3')
			.then(() => {
				connector.readdir(session, 'unifile_rename3').should.be.fulfilled;
			})
			.then(() => connector.rmdir(session, 'unifile_rename3'));
		});

		it('renames a file', function() {
			return connector.rename(session, 'unifile_rename/file1.txt', 'unifile_rename/fileB.txt')
			.then(() => {
				return connector.readFile(session, 'unifile_rename/file1.txt').should.be.rejectedWith('Not Found');
			})
			.then(() => {
				return connector.readFile(session, 'unifile_rename/fileB.txt');
			})
			.then((content) => {
				return expect(content.toString()).to.equal(data);
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_rename');
			else this.skip();
		});
	});

	describe('unlink()', function() {
		let connector;
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_unlink'},
					{name: 'writeFile', path: 'unifile_unlink/file1.txt', content: 'lorem ipsum'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.unlink(session, '')).to.be.rejectedWith('Cannot remove path with an empty name');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink(session, 'unifile_unlink/tmp.testtest')).to.be.rejectedWith('Not Found');
		});

		it('deletes a file', function() {
			return connector.unlink(session, 'unifile_unlink/file1.txt')
			.then((content) => {
				return expect(connector.readFile(session, 'unifile_unlink/file1.txt')).to.be.rejectedWith('Not Found');
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_unlink');
			else this.skip();
		});
	});

	describe('rmdir()', function() {
		let connector;
		before('Init tests folder', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_rmdir'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.rmdir(session, '')).to.be.rejectedWith('Cannot remove path with an empty name');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir(session, 'tmp.testtest')).to.be.rejectedWith('Not Found');
		});

		it('deletes a folder', function() {
			return connector.rmdir(session, 'unifile_rmdir')
			.then((content) => {
				return expect(connector.readdir(session, 'unifile_rmdir2')).to.be.rejectedWith('Not Found');
			});
		});

		after('Remove folder', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_rmdir')
			.then(() => connector.rmdir(session, 'unifile_rmdir3'));
			else this.skip();
		});
	});

	describe('batch()', function() {
		this.timeout(30000);
		let connector;
		const content = 'lorem ipsum';
		const creation = [
			{name: 'mkdir', path: 'tmp'},
			{name: 'mkdir', path: 'tmp/test'},
			{name: 'writeFile', path: 'tmp/test/a', content},
			{name: 'mkdir', path: 'tmp/test/dir'},
			{name: 'rename', path: 'tmp/test/a', destination: 'tmp/test/b'},
			{name: 'mkdir', path: 'tmp2'},
			{name: 'rename', path: 'tmp2', destination: 'tmp3'}
		];
		const destruction = [
			{name: 'rmdir', path: 'tmp3'},
			{name: 'unlink', path: 'tmp/test/b'},
			{name: 'rmdir', path: 'tmp/test'},
			{name: 'rmdir', path: 'tmp'}
		];

		beforeEach('Instanciation', function() {
			if(!isEnvValid()) this.skip();
			else {
				connector = new DropboxConnector(authConfig);
			}
		});

		it('rejects the promise if one path is empty', function() {
			return connector.batch(session, [{name: 'mkdir', path: ''}])
			.should.be.rejectedWith('Cannot execute batch action without a path');
		});

		it('rejects the promise if a rename action does not have a destination', function() {
			return connector.batch(session, [{name: 'rename', path: 'tmp'}])
			.should.be.rejectedWith('Rename actions should have a destination');
		});

		it('rejects the promise if a writefile action does not have content', function() {
			return connector.batch(session, [{name: 'writefile', path: 'tmp/test/a'}])
			.should.be.rejectedWith('Write actions should have a content');
		});

		it('rejects the promise if a conflict happen', function() {
			return connector.batch(session, [
				{name: 'mkdir', path: 'tmp'},
				{name: 'mkdir', path: 'tmp'}
			]).should.be.rejectedWith('conflict')
			.then(() => connector.rmdir(session, 'tmp'));
		});

		it('rejects the promise if a conflict happen and overwrite is not set', function() {
			const path = 'tmp/indexFile';
			const fileContent = 'html';
			const noOverwriteConnector = new DropboxConnector(Object.assign({}, authConfig, {writeMode: 'add'}));
			return noOverwriteConnector.writeFile(session, path, 'lorem')
			.then(() => {
				return noOverwriteConnector.batch(session, [{
					name: 'writefile',
					path: path,
					content: fileContent
				}]);
			}).should.be.rejectedWith('Could not complete action 0: path/conflict')
			.then(() => connector.rmdir(session, 'tmp'));
		});

		it('executes action in order', function() {
			return connector.batch(session, creation)
			.then(() => {
				return Promise.all([
					connector.readFile(session, 'tmp/test/b'),
					expect(connector.readdir(session, 'tmp3')).to.be.fulfilled
				]);
			})
			.then((results) => {
				return expect(results[0].toString()).to.equal(content);
			})
			.then(() => connector.batch(session, destruction))
			.then(() => {
				return Promise.all([
					expect(connector.readdir(session, 'tmp')).to.be.rejectedWith('Not Found'),
					expect(connector.readdir(session, 'tmp3')).to.be.rejectedWith('Not Found')
				]);
			});
		});

		it('can write files with special chars', function() {
			const path = 'tmp/specialFile';
			const fileContent = 'Àà çéèîï';
			return connector.batch(session, [{
				name: 'writefile',
				path: path,
				content: fileContent
			}])
			.then(() => {
				return connector.readFile(session, path);
			})
			.then((content) => {
				return expect(content.toString()).to.equal(fileContent);
			})
			.then(() => connector.rmdir(session, 'tmp'));
		});

		it('can overwrite existing files', function() {
			const path = 'tmp/indexFile';
			const fileContent = 'html';
			return connector.writeFile(session, path, 'lorem')
			.then(() => {
				return connector.batch(session, [{
					name: 'writefile',
					path: path,
					content: fileContent
				}]);
			})
			.then(() => {
				return connector.readFile(session, path);
			})
			.then((content) => {
				return expect(content.toString()).to.equal(fileContent);
			})
			.then(() => connector.rmdir(session, 'tmp'));
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: 'unknown_file'});
			creation.unshift({name: 'createReadStream', path: 'a/test/unknown_file'});
			return connector.batch(session, creation)
			.then(() => {
				expect(connector.readFile(session, 'tmp/test/b')).to.become(content);
				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(connector.readdir(session, 'tmp')).to.be.rejectedWith('Not Found');
			});
		});

		after('Clean up (if something wrong happened)', function() {
			if(!isEnvValid()) this.skip();
			else return connector.rmdir(session, 'tmp')
			.then(() => connector.rmdir(session, 'tmp3'))
			.catch((err) => {});
		});
	});
});
