'use strict';

const PassThrough = require('stream').PassThrough;
const chai = require('chai');
const Promise = require('bluebird');

const Unifile = require('../lib');

const expect = chai.expect;

function loggedInfos(session) {
	return {isLoggedIn: true};
}

function notLoggedInfos(session) {
	return {isLoggedIn: false};
}

describe('Unifile class', function() {
	describe('constructor', function() {
		it('create a new instance with empty config', function() {
			const unifile = new Unifile();
			expect(unifile).not.to.be.null;
			expect(unifile.connectors).to.be.an.instanceof(Map);
			expect(unifile.connectors.size).to.equal(0);
			expect(unifile.use).to.exist;
		});
	});

	describe('interface implementation', function() {
		const unifile = new Unifile();
		// Get all the Unifile connectors
		const connectors = require('fs').readdirSync('./lib').filter((file) =>
			file != 'index.js' && file != 'tools.js' && file.endsWith('.js') && !file.startsWith('.'));
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
			const fn = function() { unifile.use({}); };
			expect(fn).to.throw('Connector must have a name');
		});

		it('register a new connector', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			expect(unifile.connectors.size).to.equal(1);
			expect(unifile.connectors.get(connector.name)).to.deep.equal(connector);
		});
	});

	describe('getInfos()', function() {
		let unifile;
		beforeEach('Instanciation', function() {
			unifile = new Unifile();
		});

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.getInfos({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connectorName is not registered', function() {
			const fn = function() { unifile.getInfos({}, 'test');};
			expect(fn).to.throw('Unknown connector');
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.getInfos({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.getAuthorizeURL({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connectorName is not registered', function() {
			const fn = function() { unifile.getAuthorizeURL({}, 'test');};
			expect(fn).to.throw('Unknown connector');
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.getAuthorizeURL({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.setAccessToken({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connectorName is not registered', function() {
			const fn = function() { unifile.setAccessToken({}, 'test');};
			expect(fn).to.throw('Unknown connector');
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.setAccessToken({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.clearAccessToken({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connectorName is not registered', function() {
			const fn = function() { unifile.clearAccessToken({}, 'test');};
			expect(fn).to.throw('Unknown connector');
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.clearAccessToken({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.login({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.login({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('throws an error if no session is given', function() {
			const connector = {name: 'test', login: function() {return new Promise.resolve();}};
			unifile.use(connector);
			return expect(() => unifile.login(null, connector.name)).to.throw('No session');
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.readdir({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.readdir({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', readdir: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			unifile.readdir({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.mkdir({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.mkdir({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', mkdir: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.mkdir({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.writeFile({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.writeFile({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', writeFile: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.writeFile({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.createWriteStream({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.createWriteStream({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', createWriteStream: function() {return ;}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.createWriteStream({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.readFile({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.readFile({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', readFile: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.readFile({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.stat({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.stat({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', stat: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.stat({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.createReadStream({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.createReadStream({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', createReadStream: function() {return ;}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.createReadStream({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.rename({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.rename({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', rename: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.rename({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.unlink({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.unlink({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', unlink: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.unlink({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.rmdir({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.rmdir({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', rmdir: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.rmdir({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
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

		it('throws an error if connectorName is undefined', function() {
			const fn = function() { unifile.batch({});};
			expect(fn).to.throw(/You should specify a connector name!/);
		});

		it('throws an error if connector does not implement it', function() {
			const connector = {name: 'test'};
			unifile.use(connector);
			const fn = function() { unifile.batch({}, connector.name); };
			expect(fn).to.throw('This connector does not implement');
		});

		it('returns a rejected promise if user is not authenticated', function() {
			const connector = {name: 'test', batch: function() {return new Promise.resolve();}, getInfos: notLoggedInfos};
			unifile.use(connector);
			return unifile.batch({}, connector.name)
			// Should fail and go to catch
			.then(() => expect(false).to.be.true)
			.catch((e) => {
				expect(e).to.have.string('User not logged in yet');
			});
		});

		it('returns a promise of the writeFilefunction of the connector', function() {
			const connector = {name: 'test', batch: function() {return new Promise.resolve();}, getInfos: loggedInfos};
			unifile.use(connector);
			expect(unifile.batch({[connector.name]: {token: 'a'}}, connector.name)).to.be.an.instanceof(Promise);
		});
	});
});
