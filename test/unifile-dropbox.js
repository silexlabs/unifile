'use strict';

const Url = require('url');
const chai = require('chai');
chai.use(require('chai-as-promised'));

const DropboxConnector = require('../lib/unifile-dropbox.js');

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
	return process.env.DROPBOX_SECRET && process.env.DROPBOX_TOKEN;
}

function checkSession(session) {
	expect(session.token).to.exist;
	expect(session.account).to.exist;
	expect(session.account).to.have.all.keys('display_name', 'login', 'num_repos');
}

describe.only('DropboxConnector', function() {

	const session = {};
	const defaultConfig = {
		clientId: 'b4e46028bf36d871f68d',
		clientSecret: 'a',
		redirectUri: 'http://localhost:6805'
	};
	const authConfig = Object.assign({}, defaultConfig, {clientSecret: process.env.DROPBOX_SECRET});

	before('Init session with a valid account and tests repo', function() {
		if(isEnvValid()) {
			return new DropboxConnector(authConfig).setAccessToken(session, process.env.DROPBOX_TOKEN);
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
				expect(infos.username).to.equal('Jean-Baptiste Richardet');
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

		it('rejects the promise if the token is nor OAuth nor Basic', function() {
			const token = 'baaaad';
			const session = {};
			return connector.setAccessToken(session, token).should.be.rejectedWith('Invalid token');
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
			return expect(connector.login({}, 'anything')).to.be.rejectedWith('Invalid URL');
		});

		it('rejects the promise with the wrong credentials', function() {
			return expect(connector.login({}, 'https://toto:roro@dropbox.com')).to.be.rejectedWith('credentials');
		});

		it('rejects the promise if states do not match', function() {
			return expect(connector.login({state: 'a'}, {state: 'b', code: '22'})).to.be.rejectedWith('cross-site request');
		});

		it('accepts a string as login infos', function() {
			const user = process.env.DROPBOX_USER;
			const pwd = process.env.DROPBOX_PWD;
			if(!user || !pwd) this.skip();
			const session = {};
			return connector.login(session, `https://${user}:${pwd}@dropbox.com`)
			.then(() => {
				checkSession(session);
			});
		});

		it('accepts a string as login infos without host', function() {
			const user = process.env.DROPBOX_USER;
			const pwd = process.env.DROPBOX_PWD;
			if(!user || !pwd) this.skip();
			const session = {};
			return connector.login(session, `https://${user}:${pwd}@`)
			.then(() => {
				checkSession(session);
			});
		});

		it('accepts an Object with basic auth infos', function() {
			const user = process.env.DROPBOX_USER;
			const pwd = process.env.DROPBOX_PWD;
			if(!user || !pwd) this.skip();
			const session = {};
			return connector.login(session, {user: user, password: pwd})
			.then(() => {
				checkSession(session);
			});
		});

		it('rejects the promise if the wrong login infos are provided', function() {
			const session = {state: 'a'};
			return connector.login(session, {state: 'a', code: '222'}).should.be.rejectedWith('Unable to get access token.');
		});
	});

	describe('readdir()', function() {
		let connector;
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_readdir'},
					{name: 'mkdir', path: 'unifile_readdir/test'},
					{name: 'mkdir', path: 'unifile_readdir/test/o'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readdir(session, '/home')).to.be.rejectedWith('Not Found');
		});

		it('lists all the repos with proper entry infomations', function() {
			return connector.readdir(session, '')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		it('lists files in the repo with proper entry infomations', function() {
			return connector.readdir(session, 'unifile_readdir')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.above(0);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		it('lists files in the branch with proper entry infomations', function() {
			return connector.readdir(session, 'unifile_readdir/test')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.above(1);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		it('lists files in the directory with proper entry infomations', function() {
			return connector.readdir(session, 'unifile_readdir/test/o')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.equal(1);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readdir');
			else this.skip();
		});
	});

	describe('stat()', function() {
		let connector;
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_stat'},
					{name: 'mkdir', path: 'unifile_stat/test'},
					{name: 'mkdir', path: 'unifile_stat/test/o'},
					{name: 'writeFile', path: 'unifile_stat/test/file1.txt', content: 'lorem ipsum'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is emtpy', function() {
			return expect(connector.stat(session, '')).to.be.rejectedWith('You must provide a path');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat(session, '/home')).to.be.rejectedWith('Not Found');
		});

		it('gives stats on a repository', function() {
			return connector.stat(session, 'unifile_stat')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		it('gives stats on a branch', function() {
			return connector.stat(session, 'unifile_stat/master')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		it('gives stats on a directory', function() {
			return connector.stat(session, 'unifile_stat/test/o')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		it('gives stats on a file', function() {
			return connector.stat(session, 'unifile_stat/test/file1.txt')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_stat');
			else this.skip();
		});
	});

	describe('mkdir()', function() {
		let connector;

		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_mkdir'},
					{name: 'mkdir', path: 'unifile_mkdir/test'},
					{name: 'mkdir', path: 'unifile_mkdir/test/o'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.mkdir(session, '')).to.be.rejectedWith('Cannot create dir with an empty name.');
		});

		it('rejects the promise if the repository path already exist', function() {
			return expect(connector.mkdir(session, 'unifile_mkdir')).to.be.rejectedWith('creation failed');
		});

		it('rejects the promise if the branch path already exist', function() {
			return expect(connector.mkdir(session, 'unifile_mkdir/master')).to.be.rejectedWith('Reference already exists');
		});

		it('rejects the promise if the directory path already exist', function() {
			return expect(connector.mkdir(session, 'unifile_mkdir/test/o')).to.be.rejectedWith('Reference already exists');
		});

		it('rejects the promise if the parent does not exist', function() {
			return expect(connector.mkdir(session, 'test/tttt')).to.be.rejectedWith('Not Found');
		});

		it('creates a new repository', function() {
			return connector.mkdir(session, 'aa')
			.then(() => {
				return expect(connector.readdir(session, 'aa')).to.be.fulfilled;
			})
			.then(() => {
				return connector.rmdir(session, 'aa');
			});
		});

		it('creates a new branch', function() {
			return connector.mkdir(session, 'unifile_mkdir/test3')
			.then(() => {
				return expect(connector.readdir(session, 'unifile_mkdir/test3')).to.be.fulfilled;
			});
		});

		it('creates a new directory', function() {
			return connector.mkdir(session, 'unifile_mkdir/test/testDir')
			.then(() => {
				return expect(connector.readdir(session, 'unifile_mkdir/test/testDir')).to.be.fulfilled;
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_mkdir');
			else this.skip();
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_writeFile'},
					{name: 'mkdir', path: 'unifile_writeFile/test'},
					{name: 'mkdir', path: 'unifile_writeFile/test/o'},
					{name: 'writeFile', path: 'unifile_writeFile/test/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is a repository', function() {
			return connector.writeFile(session, 'unifile_writeFile', data)
			.should.be.rejectedWith('This folder can only contain folders');
		});

		it('rejects the promise if the path is a branch', function() {
			return connector.writeFile(session, 'unifile_writeFile/test', data)
			.should.be.rejectedWith('This folder can only contain folders');
		});

		it('writes into a file', function() {
			return connector.writeFile(session, 'unifile_writeFile/test/testFile', data)
			.then(() => {
				return connector.readFile(session, 'unifile_writeFile/test/testFile').should.become(data);
			})
			.then(() => {
				return connector.unlink(session, 'unifile_writeFile/test/testFile');
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_writeFile');
			else this.skip();
		});
	});

	describe('createWriteStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_writeStream'},
					{name: 'mkdir', path: 'unifile_writeStream/test'},
					{name: 'mkdir', path: 'unifile_writeStream/test/o'},
					{name: 'writeFile', path: 'unifile_writeStream/test/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('emits an error if the path is a repository', function(done) {
			const stream = connector.createWriteStream(session, 'unifile_writeStream', data);
			stream.on('error', (err) => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});

			stream.end(data);
		});

		it('rejects the promise if the path is a branch', function(done) {
			const stream = connector.createWriteStream(session, 'unifile_writeStream/test3', data);
			stream.on('error', (err) => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});

			stream.end(data);
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream(session, 'unifile_writeStream/test/testStream');
			// Wait for 'end' (not 'finish') to be sure it has been consumed
			stream.on('close', () => {
				return connector.readFile(session, 'unifile_writeStream/test/testStream')
				.then((result) => {
					expect(result).to.equal(data);
					done();
				})
				// Needed because the promise would catch the expect thrown exception
				.catch(done);
			});
			stream.on('error', done);
			stream.end(data);
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_writeStream');
			else this.skip();
		});
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';

		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_readFile'},
					{name: 'mkdir', path: 'unifile_readFile/test'},
					{name: 'mkdir', path: 'unifile_readFile/test/o'},
					{name: 'writeFile', path: 'unifile_readFile/test/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile(session, 'a/test/auoeuiqu')).to.be.rejectedWith('Not Found');
		});

		it('rejects the promise if the path is a repo or branch', function() {
			return Promise.all(['unifile_readFile', 'unifile_readFile/master'].map((path) => {
				return expect(connector.readFile(session, path)).to.be
				.rejectedWith('This folder only contain folders. Files can be found in sub-folders.');
			}));
		});

		it('rejects the promise if the path is a directory', function() {
			return expect(connector.readFile(session, 'unifile_readFile/test/o')).to.be.rejectedWith('Path is a directory');
		});

		it('returns the content of a file', function() {
			return connector.readFile(session, 'unifile_readFile/test/file1.txt').should.become(data);
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readFile');
			else this.skip();
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';

		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_readstream'},
					{name: 'mkdir', path: 'unifile_readstream/test'},
					{name: 'mkdir', path: 'unifile_readstream/test/o'},
					{name: 'writeFile', path: 'unifile_readstream/test/file1.txt', content: data}
				]));
			} else this.skip();
		});

		it('throws an error if wrong credentials', function(done) {
			const stream = connector.createReadStream(Object.assign({}, session, {
				token: 'aoa'
			}), 'aouoeuoeu');
			stream.on('error', (err) => {
				expect(err.message).to.equal('Bad credentials');
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
			stream.on('data', () => {
				done(new Error('Should not emit this event'));
			});
		});

		it('creates a readable stream', function(done) {
			const chunks = [];
			const stream = connector.createReadStream(session, 'unifile_readstream/test/file1.txt');
			stream.on('end', () => {
				expect(Buffer.concat(chunks).toString()).to.equal(data);
				done();
			});
			stream.on('error', done);
			stream.on('data', (content) => chunks.push(content));
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readstream');
			else this.skip();
		});
	});

	describe('rename()', function() {
		let connector;
		const data = 'lorem ipsum';
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_rename'},
					{name: 'mkdir', path: 'unifile_rename2'},
					{name: 'mkdir', path: 'unifile_rename/test'},
					{name: 'mkdir', path: 'unifile_rename/testRename'},
					{name: 'mkdir', path: 'unifile_rename/test/o'},
					{name: 'writeFile', path: 'unifile_rename/test/file1.txt', content: data}
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

		it('renames a repository', function() {
			return connector.rename(session, 'unifile_rename2', 'unifile_rename3')
			.then(() => {
				connector.readdir(session, 'unifile_rename3').should.be.fulfilled;
			})
			.then(() => connector.rmdir(session, 'unifile_rename3'));
		});

		it('renames a branch', function() {
			return connector.rename(session, 'unifile_rename/testRename', 'unifile_rename/testRenamed')
			.then(() => {
				return Promise.all([
					connector.readdir(session, 'unifile_rename/testRename').should.be.rejected,
					connector.readdir(session, 'unifile_rename/testRenamed').should.be.fulfilled
				]);
			})
			.finally(() => connector.rmdir(session, 'unifile_rename/testRenamed'), (err) => {});
		});

		it('renames a folder', function() {
			return connector.rename(session, 'unifile_rename/test/o', 'unifile_rename/test/p')
			.then(() => {
				return connector.readdir(session, 'unifile_rename/test/o').should.be.rejectedWith('Not Found');
			})
			.then(() => {
				return connector.readdir(session, 'unifile_rename/test/p').should.be.fulfilled;
			});
		});

		it('renames a file', function() {
			return connector.rename(session, 'unifile_rename/test/file1.txt', 'unifile_rename/test/fileB.txt')
			.then(() => {
				return connector.readFile(session, 'unifile_rename/test/file1.txt').should.be.rejectedWith('Not Found');
			})
			.then(() => {
				return connector.readFile(session, 'unifile_rename/test/fileB.txt').should.become(data);
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_readstream');
			else this.skip();
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_rename');
			else this.skip();
		});
	});

	describe('unlink()', function() {
		let connector;
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_unlink'},
					{name: 'mkdir', path: 'unifile_unlink/test'},
					{name: 'mkdir', path: 'unifile_unlink/test/o'},
					{name: 'writeFile', path: 'unifile_unlink/test/file1.txt', content: 'lorem ipsum'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.unlink(session, '')).to.be.rejectedWith('Cannot remove path with an empty name');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink(session, 'unifile_unlink/test/tmp.testtest')).to.be.rejectedWith('Not Found');
		});

		it('rejects the promise if the path is a branch/repo', function() {
			return Promise.all([
				expect(connector.unlink(session, 'unifile_unlink')).to.be.rejectedWith('Path is a folder'),
				expect(connector.unlink(session, 'unifile_unlink/test')).to.be.rejectedWith('Path is a folder')
			]);
		});

		it('deletes a file', function() {
			return connector.unlink(session, 'unifile_unlink/test/file1.txt')
			.then((content) => {
				return expect(connector.readFile(session, 'unifile_unlink/test/file1.txt')).to.be.rejectedWith('Not Found');
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_unlink');
			else this.skip();
		});
	});

	describe('rmdir()', function() {
		let connector;
		before('Init tests repo', function() {
			if(isEnvValid()) {
				connector = new DropboxConnector(authConfig);
				return connector.setAccessToken(session, process.env.DROPBOX_TOKEN)
				.then(() => connector.batch(session, [
					{name: 'mkdir', path: 'unifile_rmdir2'},
					{name: 'mkdir', path: 'unifile_rmdir3'},
					{name: 'mkdir', path: 'unifile_rmdir'},
					{name: 'mkdir', path: 'unifile_rmdir/toremove'},
					{name: 'mkdir', path: 'unifile_rmdir/test'},
					{name: 'mkdir', path: 'unifile_rmdir/test/o'}
				]));
			} else this.skip();
		});

		it('rejects the promise if the path is empty', function() {
			return expect(connector.rmdir(session, '')).to.be.rejectedWith('Cannot remove path with an empty name');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir(session, 'tmp.testtest')).to.be.rejectedWith('Not Found');
		});

		it('rejects the promise if the branch is alone', function() {
			return expect(connector.rmdir(session, 'unifile_rmdir3/master'))
			.to.be.rejectedWith('You cannot leave this folder empty');
		});

		it('deletes a repo', function() {
			return connector.rmdir(session, 'unifile_rmdir2')
			.then((content) => {
				return expect(connector.readdir(session, 'unifile_rmdir2')).to.be.rejectedWith('Not Found');
			});
		});

		it('deletes a branch', function() {
			return connector.rmdir(session, 'unifile_rmdir/toremove')
			.then((content) => {
				return expect(connector.readdir(session, 'unifile_rmdir/toremove')).to.be.rejectedWith('Not Found');
			});
		});

		it('deletes a directory', function() {
			return connector.rmdir(session, 'unifile_rmdir/test/o')
			.then((content) => {
				return expect(connector.readdir(session, 'unifile_rmdir/test/o')).to.be.rejectedWith('Not Found');
			});
		});

		after('Remove repo', function() {
			if(isEnvValid()) connector.rmdir(session, 'unifile_rmdir')
			.then(() => connector.rmdir(session, 'unifile_rmdir3'));
			else this.skip();
		});
	});

	describe('batch()', function() {
		this.timeout(30000);
		let connector;
		const creation = [
			{name: 'mkdir', path: 'tmp'},
			{name: 'mkdir', path: 'tmp/test'},
			{name: 'writeFile', path: 'tmp/test/a', content: 'aaa'},
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

		it('rejects the promise if one repo/branch action failed', function() {
			return connector.batch(session, [{name: 'mkdir', path: 'authouou/outeum'}])
			.should.be.rejectedWith('Could not complete action');
		});

		it('rejects the promise if a rename action on repo/branch does not have a destination', function() {
			return connector.batch(session, [{name: 'rename', path: 'tmp'}])
			.should.be.rejectedWith('Rename actions should have a destination');
		});

		it('rejects the promise if a rename action does not have a destination', function() {
			return connector.batch(session, [{name: 'rename', path: 'tmp/test/a'}])
			.should.be.rejectedWith('Could not modify tree');
		});

		it('rejects the promise if a writefile action does not have content', function() {
			return connector.batch(session, [{name: 'writefile', path: 'tmp/test/a'}])
			.should.be.rejectedWith('Could not modify tree');
		});

		it('rejects the promise if a writefile is programmed on a repo/branch', function() {
			return connector.batch(session, [{name: 'writefile', path: 'tmp/test', content: 'aaaa'}])
			.should.be.rejectedWith('Cannot create file here');
		});

		it('executes action in order', function() {
			return connector.batch(session, creation)
			.then(() => {
				return Promise.all([
					expect(connector.readFile(session, 'tmp/test/b')).to.become('aaa'),
					expect(connector.readdir(session, 'tmp3')).to.be.fulfilled
				]);
			})
			.then(() => connector.batch(session, destruction))
			.then(() => {
				return Promise.all([
					expect(connector.readdir(session, 'tmp')).to.be.rejectedWith('Not Found'),
					expect(connector.readdir(session, 'tmp3')).to.be.rejectedWith('Not Found')
				]);
			});
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: 'unknown_file'});
			creation.unshift({name: 'createReadStream', path: 'a/test/unknown_file'});
			return connector.batch(session, creation)
			.then(() => {
				expect(connector.readFile(session, 'tmp/test/b')).to.become('aaa');
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
