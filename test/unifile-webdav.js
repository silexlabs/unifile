'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const {WebDAVServer, VirtualFolder, VirtualFile, HTTPBasicAuthentication} = require('webdav-server');

const WebDavConnector = require('../lib/unifile-webdav');

const expect = chai.expect;
chai.should();

// Shut up console logging
console.warn = function() {};

const webdavDefaultInfos = {
	name: 'webdav',
	displayName: 'WebDAV',
	icon: '../assets/webdav.png',
	description: 'Edit files on a WebDAV server'
};

describe('WebDAVConnector', function() {
	this.slow(200);

	let testFile;
	let srv = null;
	const session = {
		host: 'http://127.0.0.1/',
		port: '9876',
		user: 'admin',
		password: 'admin'
	};

	beforeEach('Instanciation', function(done) {
		srv = new WebDAVServer({
			requireAuthentification: true,
			hostname: '127.0.0.1',
			port: session.port,
			httpAuthentication: new HTTPBasicAuthentication('default realm')
		});
		testFile = new VirtualFile('testA.txt');
		srv.userManager.addUser('admin', 'admin');
		srv.addResourceTree({
			r: new VirtualFolder('testFolder'),
			c: [{
				r: new VirtualFolder('test1'),
				c: new VirtualFile('test2')
			}, {
				r: new VirtualFolder('test2'),
				c: [{
					r: new VirtualFolder('test1'),
					c: new VirtualFile('test2')
				}, {
					r: new VirtualFolder('test2'),
					c: new VirtualFile('test2')
				}]
			}, {
				r: testFile
			}]
		}, () => srv.start((httpServer) => {
			testFile.write(true, (err, stream) => {
				stream.end('lorem ipsum');
				done();
			});
		}));
	});

	describe('constructor', function() {
		it('throws an error with empty config', function() {
			expect(() => new WebDavConnector()).to.throw('You should at least set a redirectUri');
		});

		it('overrides infos when given in config', function() {
			const overrides = {
				name: 'aaa',
				displayName: 'bbb',
				icon: 'ccc',
				description: 'dddd'
			};
			Object.keys(overrides).forEach((key) => {
				const config = {infos: {}, redirectUri: 'a'};
				config.infos[key] = overrides[key];
				const connector = new WebDavConnector(config);
				expect(connector).to.exist;
				Object.keys(connector.infos).forEach((info) => {
					if(info !== key)
						expect(connector.infos[info]).to.equal(webdavDefaultInfos[info]);
					else
						expect(connector.infos[info]).to.equal(overrides[info]);
				});
				if(key === 'name')
					expect(connector.name).to.equal(overrides.name);
				else
					expect(connector.name).to.equal(webdavDefaultInfos.name);
			});
		});

		it('ignores invalid infos', function() {
			const connector = new WebDavConnector({infos: 3, redirectUri: 'a'});
			expect(connector.infos).to.deep.equal(webdavDefaultInfos);
		});
	});

	describe('getInfos()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: 'a'});
		});

		it('returns an infos object', function() {
			const infos = connector.getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(webdavDefaultInfos.name);
			expect(infos.displayName).to.equal(webdavDefaultInfos.displayName);
			expect(infos.icon).to.equal(webdavDefaultInfos.icon);
			expect(infos.description).to.equal(webdavDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.undefined;
		});

		it('returns a customed infos object is told so', function() {
			const infos = new WebDavConnector({infos: {icon: 'ooo'}, redirectUri: 'a'}).getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(webdavDefaultInfos.name);
			expect(infos.displayName).to.equal(webdavDefaultInfos.displayName);
			expect(infos.icon).to.equal('ooo');
			expect(infos.description).to.equal(webdavDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.undefined;
		});
	});

	describe('getAuthorizeURL()', function() {
		const redirectUri = '/redirect';
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: redirectUri});
		});

		it('returns a promise for the redirect URI', function() {
			expect(connector.getAuthorizeURL({})).to.become(redirectUri);
		});
	});

	describe('setAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('returns a promise of the token while setting it the session', function() {
			const token = 'token';
			const session = {};
			return connector.setAccessToken(session, token)
			.then((t) => {
				expect(t).to.equal(token);
				expect(session.token).to.equal(token);
			});
		});
	});

	describe('clearAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('returns an empty promise', function() {
			const session = {};
			return connector.clearAccessToken(session)
			.then(() => {
				expect(session).to.be.empty;
			});
		});
	});

	describe('login()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('returns a rejected promise with malformed credentials', function() {
			return expect(connector.login({}, 'anything')).to.be.rejectedWith('Invalid URL');
		});

		it('returns a rejected promise with the wrong credentials', function() {
			return expect(connector.login({}, 'http://toto:roro@127.0.0.1:9876')).to.be.rejectedWith('credentials');
		});

		it('accepts a string as login infos', function() {
			const session = {};
			return connector.login(session, 'http://admin:admin@127.0.0.1:9876')
			.then(() => {
				expect(session.host).to.equal('http://127.0.0.1/');
				expect(session.port).to.equal('9876');
				expect(session.user).to.equal('admin');
				expect(session.password).to.equal('admin');
			});
		});

		it('accepts an object as login infos', function() {
			const session = {};
			return connector.login(session, {
				host: '127.0.0.1',
				port: '9876',
				user: 'admin',
				password: 'admin'
			})
			.then(() => {
				expect(session.host).to.equal('http://127.0.0.1/');
				expect(session.port).to.equal('9876');
				expect(session.user).to.equal('admin');
				expect(session.password).to.equal('admin');
			});
		});
	});

	describe('readdir()', function() {
		let connector;
		before('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if it cannot connect to host', function() {
			return expect(connector.readdir({
				host: 'http://127.0.0.1/',
				user: 'a',
				password: 'a'
			}, '/home/test')).to.be.rejectedWith('ECONNREFUSED');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readdir(session, '/home/test')).to.be.rejectedWith('Not Found');
		});

		it('lists files in the directory with proper entry infomations', function() {
			return connector.readdir(session, 'testFolder')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.equal(3);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});
	});

	describe('stat()', function() {
		let connector;
		before('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat(session, '/home/test')).to.be.rejectedWith('Not Found');
		});

		it('gives stats on a directory', function() {
			return connector.stat(session, 'testFolder')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		it('gives stats on a file', function() {
			return connector.stat(session, 'testFolder/testA.txt')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});
	});

	describe('mkdir()', function() {
		let connector;

		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('throws an error if the path already exist', function() {
			return expect(connector.mkdir(session, 'testFolder')).to.be.rejectedWith('EEXIST');
		});

		it('throws an error if the parent does not exist', function() {
			return expect(connector.mkdir(session, 'test/tttt')).to.be.rejectedWith('Conflict');
		});

		it('creates a new directory', function() {
			return connector.mkdir(session, 'testFolder2')
			.then(() => {
				return expect(connector.readdir(session, 'testFolder2')).to.be.fulfilled;
			});
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('writes into a file', function() {
			return connector.writeFile(session, 'tmp.test', data)
			.then(() => {
				return connector.readFile(session, 'tmp.test')
				.then((content) => {
					return expect(content.toString()).to.equal(data);
				});
			});
		});
	});

	describe('createWriteStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream(session, 'tmp.test');
			// Wait for 'end' (not 'finish') to be sure it has been consumed
			stream.on('end', () => {
				return connector.readFile(session, 'tmp.test')
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
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';

		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile(session, 'aouoeuoeu')).to.be.rejectedWith('Not Found');
		});

		it('returns the content of a file', function() {
			return connector.readFile(session, 'testFolder/testA.txt')
			.then((content) => {
				expect(content.toString()).to.equal(data);
				expect(content).to.be.an.instanceof(Buffer);
			});
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';

		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('throws an error if wrong credentials', function(done) {
			const stream = connector.createReadStream({
				host: 'http://127.0.0.1/',
				port: '9876',
				user: 'a',
				password: 'a'
			}, 'aouoeuoeu');
			stream.on('error', (err) => {
				expect(err.message).to.equal('Unauthorized');
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
			const stream = connector.createReadStream(session, 'testFolder/testA.txt');
			stream.on('end', () => {
				expect(Buffer.concat(chunks).toString()).to.equal(data);
				done();
			});
			stream.on('error', done);
			stream.on('data', (content) => chunks.push(content));
		});
	});

	describe('rename()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if one of the paths does not exist', function() {
			return expect(connector.rename(session, '/home/test', 'home/test2')).to.be.rejectedWith('Not Found');
		});

		it('renames a file', function() {
			return connector.rename(session, 'testFolder/testA.txt', 'testFolder/testB.txt')
			.then((content) => {
				return connector.readFile(session, 'testFolder/testA.txt').should.be.rejectedWith('Not Found');
			})
			.then(() => {
				return connector.readFile(session, 'testFolder/testB.txt')
				.then((content) => {
					return expect(content.toString()).to.equal('lorem ipsum');
				});
			});
		});
	});

	describe('unlink()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink(session, 'tmp.testtest')).to.be.rejectedWith('Not Found');
		});

		it('deletes a file', function() {
			return connector.unlink(session, 'testFolder/testA.txt')
			.then((content) => {
				return expect(connector.readFile(session, 'testFolder/testA.txt')).to.be.rejectedWith('Not Found');
			});
		});
	});

	describe('rmdir()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir(session, 'tmp.testtest')).to.be.rejectedWith('Not Found');
		});

		it('deletes a directory', function() {
			return connector.rmdir(session, 'testFolder/test1')
			.then((content) => {
				return expect(connector.readdir(session, 'testFolder/test1')).to.be.rejectedWith('Not Found');
			});
		});
	});

	describe('batch()', function() {
		this.timeout(5000);
		let connector;
		const creation = [
			{name: 'mkdir', path: 'tmp'},
			{name: 'writeFile', path: 'tmp/a', content: 'aaa'},
			{name: 'rename', path: 'tmp/a', destination: 'tmp/b'}
		];
		const destruction = [
			{name: 'unlink', path: 'tmp/b'},
			{name: 'rmdir', path: 'tmp'}
		];
		beforeEach('Instanciation', function() {
			connector = new WebDavConnector({redirectUri: '/redirect'});
		});

		it('executes action in order', function() {
			return connector.batch(session, creation)
			.then(() => {
				expect(connector.readFile(session, 'tmp/b')).to.become('aaa');
				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(connector.readdir(session, 'tmp')).to.be.rejectedWith('Not Found');
			});
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: 'unknown_file'});
			return connector.batch(session, creation)
			.then(() => {
				expect(connector.readFile(session, 'tmp/b')).to.become('aaa');
				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(connector.readdir(session, 'tmp')).to.be.rejectedWith('Not Found');
			});
		});
	});

	afterEach('Tear down', function(done) {
		return srv.stop(done);
	});
});
