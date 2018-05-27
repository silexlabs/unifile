'use strict';

const {Readable, Writable, Transform, PassThrough} = require('stream');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const Promise = require('bluebird');

const Unifile = require('../lib');

const expect = chai.expect;

function loggedInfos(session) {
	return {isLoggedIn: true};
}

function notLoggedInfos(session) {
	return {isLoggedIn: false};
}

function checkNotLoggedIn(promise) {
	return promise
	// Should fail and go to catch
	.then(() => expect(false).to.be.true)
	.catch((e) => {
		expect(e.message).to.have.string('User not logged in');
	});
}

describe('Unifile class', function() {
	describe('constructor', function() {
		it('create a new instance with empty config', function() {
			const unifile = new Unifile();
			expect(unifile).not.to.be.null;
			expect(unifile.use).to.exist;
		});
	});

	describe('interface implementation', function() {
		const unifile = new Unifile();
		// Get all the Unifile connectors
		const connectors = require('fs').readdirSync('./lib').filter((file) =>
			file != 'index.js' && file != 'error.js' && file.endsWith('.js') && !file.startsWith('.'));
		// Get all the methods of Unifile
		const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(unifile))
		// Filter out the one that should be implemented
		.filter((method) => !['callMethod', 'listConnectors', 'use'].includes(method))
		// Sort them alphabetically
		.sort();
		for(const connectorName of connectors) {
			describe(connectorName, function() {
				it('have to implement all the Unifile functions', function() {
					const Connector = require('../lib/' + connectorName);
					const instance = new Connector({clientId: 'a', clientSecret: 'a', redirectUri: 'a'});
					const connectorMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
					.sort();
					const missings = methods.filter((m) => !connectorMethods.includes(m));
					expect(missings.length).to.equal(0, 'These methods are missing: ' + missings);
				});
			});
		}
	});

	describe('use()', function() {
		let unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('throws an error if connector is undefined', function() {
			expect(unifile.use).to.throw('Connector cannot be undefined');
		});

		it('throws an error if connector does not have a name', function() {
			return expect(() => unifile.use({})).to.throw('Connector must have a name');
		});

		it('register a new connector', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			expect(unifile.listConnectors().length).to.equal(1);
			expect(unifile.listConnectors()[0]).to.equal(connector.name);
		});
	});

	describe('ext()', function() {
		let unifile;
		let inMemoryFile = '';
		beforeEach('Instanciation', function() {
			inMemoryFile = '';
			unifile = new Unifile();
			unifile.use({
				name: 'memory',
				getInfos: () => {return {isLoggedIn: true};},
				readFile: (session, path) => Promise.resolve(inMemoryFile),
				writeFile: (session, path, content) => {
					inMemoryFile = content;
					return Promise.resolve();
				},
				createReadStream: (session, path) => {
					return new Readable({
						read(size) {
							this.push('hello');
							this.push(null);
						}
					});
				},
				createWriteStream: (session, path) => {
					//return require('fs').createWriteStream('./test.log');
					return new Writable({
						write(chunk, encoding, callback) {
							inMemoryFile += chunk.toString();
							callback(null);
						}
					});
				}
			});
		});

		it('registers an extension', function() {
			unifile.ext({
				onWrite: console.log,
				onRead: console.log
			});
			expect(unifile.plugins.onRead).to.equal(console.log);
			expect(unifile.plugins.onWrite).to.equal(console.log);
		});

		it('can modify the input on write action', function() {
			unifile.ext({
				onWrite: (input) => input.replace('a', 'b')
			});
			return unifile.writeFile({}, 'memory', '', 'ab')
			.then(() => expect(inMemoryFile).to.equal('bb'));
		});

		it('can modify the input on read action', function() {
			inMemoryFile = 'ab';
			unifile.ext({
				onRead: (input) => input.replace('b', 'a')
			});
			return unifile.readFile({}, 'memory', '')
			.should.eventually.equal('aa');
		});

		it('can modify the input on write stream', function(done) {
			unifile.ext({
				onWriteStream: new Transform({
					transform(chunk, encoding, callback) {
						callback(null, chunk.toString().toUpperCase());
					}
				})
			});
			const stream = unifile.createWriteStream({}, 'memory', '');
			stream.on('end', () => {
				expect(inMemoryFile).to.equal('HELLO');
				done();
			});
			stream.end('hello');
		});

		it('can modify the input on read stream', function(done) {
			inMemoryFile = 'hello';
			unifile.ext({
				onReadStream: new Transform({
					transform(chunk, encoding, callback) {
						callback(null, chunk.toString().toUpperCase());
					}
				})
			});
			const stream = unifile.createReadStream({}, 'memory', '');
			const chunks = [];
			stream.on('data', (chunk) => {
				chunks.push(chunk);
			});
			stream.on('end', () => {
				expect(Buffer.concat(chunks).toString()).to.equal('HELLO');
				done();
			});
		});
	});

	describe('getInfos()', function() {
		let unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.getInfos({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connectorName is not registered', function() {
			expect(unifile.getInfos({}, 'test')).to.be.rejectedWith('Unknown connector');
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			expect(unifile.getInfos({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns an infos object', function() {
			const connector = {name: 'test', getInfos: function(session) {return {name: this.name};}};
			unifile.use(connector);
			const infos = unifile.getInfos({}, connector.name);
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal('test');
		});
	});

	describe('listConnectors()', function() {
		let unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('returns an emty array if no connector is used', function() {
			const list = unifile.listConnectors();
			expect(list).to.be.an.instanceof(Array);
			expect(list.length).to.equal(0);
		});

		it('returns an array of connectors names', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			unifile.use({name: 'test2'});
			const list = unifile.listConnectors(connector.name);
			expect(list).to.be.an.instanceof(Array);
			expect(list.length).to.equal(2);
			expect(list[0]).to.equal(connector.name);
		});
	});

	describe('getAuthorizeURL()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.getAuthorizeURL({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connectorName is not registered', function() {
			return expect(unifile.getAuthorizeURL({}, 'test')).to.be.rejectedWith('Unknown connector');
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.getAuthorizeURL({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a promise of the getAuthorizeURL function of the connector', function() {
			const connector = {name: 'test', getAuthorizeURL: function() {return new Promise.resolve();}};
			unifile.use(connector);
			expect(unifile.getAuthorizeURL({}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('setAccessToken()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.setAccessToken({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connectorName is not registered', function() {
			return expect(unifile.setAccessToken({}, 'test')).to.be.rejectedWith('Unknown connector');
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.setAccessToken({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a promise of the setAccessToken function of the connector', function() {
			const connector = {name: 'test', setAccessToken: function() {return new Promise.resolve();}};
			unifile.use(connector);
			expect(unifile.setAccessToken({}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('clearAccessToken()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.clearAccessToken({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connectorName is not registered', function() {
			return expect(unifile.clearAccessToken({}, 'test')).to.be.rejectedWith('Unknown connector');
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.clearAccessToken({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a promise of the clearAccessToken function of the connector', function() {
			const connector = {name: 'test', clearAccessToken: function() {return new Promise.resolve();}};
			unifile.use(connector);
			expect(unifile.clearAccessToken({}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('login()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.login({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.login({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('rejects the promise if no session is given', function() {
			const connector = {name: 'test', login: function() {return new Promise.resolve();}};
			unifile.use(connector);
			return expect(unifile.login(null, connector.name)).to.be.rejectedWith('No session');
		});

		it('returns a promise of the login function of the connector', function() {
			const connector = {name: 'test', login: function() {return new Promise.resolve();}};
			unifile.use(connector);
			expect(unifile.login({test: {}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('readdir()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.readdir({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.readdir({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', readdir: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			checkNotLoggedIn(unifile.readdir({}, connector.name));
		});

		it('returns a promise of the readdir function of the connector', function() {
			const connector = {name: 'test', readdir: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.readdir({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('mkdir()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.mkdir({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.mkdir({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', mkdir: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.mkdir({}, connector.name));
		});

		it('returns a promise of the mkdir function of the connector', function() {
			const connector = {name: 'test', mkdir: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.mkdir({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('writeFile()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.writeFile({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.writeFile({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', writeFile: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.writeFile({}, connector.name));
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', writeFile: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.writeFile({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('createWriteStream()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.createWriteStream({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.createWriteStream({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', createWriteStream: function() {return ;}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.createWriteStream({}, connector.name));
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {
				name: 'test',
				createWriteStream: function() {return new PassThrough();},
				getInfos: loggedInfos
			};
			unifile.use(connector);
			expect(unifile.createWriteStream({[connector.name]: {token: 'a'}}, connector.name))
			.to.be.an.instanceof(PassThrough);
		});
	});

	describe('readFile()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.readFile({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.readFile({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', readFile: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.readFile({}, connector.name));
		});

		it('returns a promise of the readFile of the connector', function() {
			const connector = {name: 'test', readFile: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.readFile({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('stat()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.stat({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.stat({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', stat: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.stat({}, connector.name));
		});

		it('returns a promise of the stat of the connector', function() {
			const connector = {name: 'test', stat: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.stat({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('createReadStream()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.createReadStream({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.createReadStream({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', createReadStream: function() {return ;}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.createReadStream({}, connector.name))
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', createReadStream: function() {return new PassThrough();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.createReadStream({[connector.name]: {token: 'a'}}, connector.name))
			.to.be.an.instanceof(PassThrough);
		});
	});

	describe('rename()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.rename({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.rename({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', rename: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.rename({}, connector.name));
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', rename: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.rename({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('unlink()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.unlink({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.unlink({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', unlink: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.unlink({}, connector.name));
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', unlink: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.unlink({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('rmdir()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.rmdir({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.rmdir({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', rmdir: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.rmdir({}, connector.name));
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', rmdir: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.rmdir({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});

	describe('batch()', function() {
		var unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('rejects the promise if connectorName is undefined', function() {
			return expect(unifile.batch({})).to.be.rejectedWith(/You should specify a connector name!/);
		});

		it('rejects the promise if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			return expect(unifile.batch({}, connector.name)).to.be.rejectedWith('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', batch: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return checkNotLoggedIn(unifile.batch({}, connector.name));
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', batch: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.batch({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});
});
