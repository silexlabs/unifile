'use strict';

const Promise = require('bluebird');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const {Readable, Writable} = require('stream');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const FtpSrv = require('ftp-srv');
const FileSystem = require('../node_modules/ftp-srv/src/fs.js');

const FtpConnector = require('../lib/unifile-ftp');
const {UnifileError} = require('../lib/error');

const expect = chai.expect;
chai.should();

// Shut up console logging
console.warn = function() {};

const ftpDefaultInfos = {
	name: 'ftp',
	displayName: 'FTP',
	icon: '../assets/ftp.png',
	description: 'Edit files on a web FTP server.'
};

function checkFileStat(stat) {
	expect(stat).to.be.an.instanceof(Object);
	expect(stat).to.have.keys(['isDir', 'mime', 'modified', 'name', 'size']);
	expect(stat.size).to.be.a('number')
	.and.to.be.finite;
	expect(stat.name).to.be.a('string');
	expect(stat.isDir).to.be.a('boolean');
	expect(stat.mime).to.satisfy((mime) => mime === null || mime.constructor === String);
	expect(new Date(stat.modified).getTime(), 'Invalid date').to.be.finite;

}

describe.only('FtpConnector', function() {
	let srv = null;
	const session = {
		host: '127.0.0.1',
		port: '9876',
		user: 'admin',
		password: 'admin'
	};

	before('Instanciation', function() {
		srv = new FtpSrv(`ftp://${session.host}:${session.port}`, {
			pasv_range: '9000-9010'
		});
		// Shut up the FTP server
		srv.log.level('fatal');


		// Declare FS
		const fs = new FileSystem(this);

		srv.on('login', ({connection, username, password}, resolve, reject) => {
			if(username === 'admin' && password === 'admin') resolve({fs: fs});
			else reject(new Error('Wrong credentials'));
		});
		srv.on('client-error', ({error}) => {
			console.error('Error on the client connection', error);
		});

		return srv.listen();
	});

	describe('constructor', function() {
		it('throws an error with empty config', function() {
			expect(() => new FtpConnector()).to.throw('You should at least set a redirectUri');
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
				const connector = new FtpConnector(config);
				expect(connector).to.exist;
				Object.keys(connector.infos).forEach((info) => {
					if(info !== key)
						expect(connector.infos[info]).to.equal(ftpDefaultInfos[info]);
					else
						expect(connector.infos[info]).to.equal(overrides[info]);
				});
				if(key === 'name')
					expect(connector.name).to.equal(overrides.name);
				else
					expect(connector.name).to.equal(ftpDefaultInfos.name);
			});
		});

		it('ignores invalid infos', function() {
			const connector = new FtpConnector({infos: 3, redirectUri: 'a'});
			expect(connector.infos).to.deep.equal(ftpDefaultInfos);
		});
	});

	describe('getInfos()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: 'a'});
		});

		it('returns an infos object', function() {
			const infos = connector.getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(ftpDefaultInfos.name);
			expect(infos.displayName).to.equal(ftpDefaultInfos.displayName);
			expect(infos.icon).to.equal(ftpDefaultInfos.icon);
			expect(infos.description).to.equal(ftpDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.undefined;
		});

		it('returns a customed infos object is told so', function() {
			const infos = new FtpConnector({infos: {icon: 'ooo'}, redirectUri: 'a'}).getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(ftpDefaultInfos.name);
			expect(infos.displayName).to.equal(ftpDefaultInfos.displayName);
			expect(infos.icon).to.equal('ooo');
			expect(infos.description).to.equal(ftpDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.undefined;
		});
	});

	describe('getAuthorizeURL()', function() {
		const redirectUri = '/redirect';
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: redirectUri});
		});

		it('returns a promise for the redirect URI', function() {
			expect(connector.getAuthorizeURL({})).to.become(redirectUri);
		});
	});

	describe('setAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
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
			connector = new FtpConnector({redirectUri: '/redirect'});
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
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('returns a rejected promise with malformed credentials', function() {
			return expect(connector.login({}, 'anything')).to.be.rejectedWith('Invalid URL');
		});

		it('returns a rejected promise with the wrong credentials', function() {
			return expect(connector.login({}, 'ftp://toto:roro@127.0.0.1:9876')).to.be.rejectedWith('Invalid credentials');
		});

		it('accepts a string as login infos', function() {
			const session = {};
			return connector.login(session, 'ftp://admin:admin@127.0.0.1:9876')
			.then(() => {
				expect(session.host).to.equal('127.0.0.1');
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
				expect(session.host).to.equal('127.0.0.1');
				expect(session.port).to.equal('9876');
				expect(session.user).to.equal('admin');
				expect(session.password).to.equal('admin');
			});
		});
	});

	describe('readdir()', function() {
		let connector;
		before('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {

			return expect(connector.readdir(session, '/home/test')).to.be.eventually.rejected
			.and.be.an.instanceof(UnifileError)
			.and.have.property('code', UnifileError.ENOENT);
		});

		it('reads root with empty path', function() {
			return connector.readdir(session, '')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.be.above(0);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			});
		});

		it('lists files in the directory with proper entry infomations', function() {
			return connector.readdir(session, '/')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.be.above(0);
				list.forEach(checkFileStat);
				const libFolder = list.find((f) => f.name === 'lib');
				expect(libFolder.isDir).to.be.true;
				expect(libFolder.mime).to.equal('application/directory');
				const packageFile = list.find((f) => f.name === 'package.json');
				expect(packageFile.isDir).to.be.false;
				expect(packageFile.mime).to.equal('application/json');
				expect(packageFile.size).to.above(0);
			});
		});
	});

	describe('stat()', function() {
		let connector;
		before('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat(session, '/home/test')).to.be.eventually.rejected
			.and.be.an.instanceof(UnifileError)
			.and.have.property('code', UnifileError.ENOENT);
		});

		it('gives stats on a directory', function() {
			return connector.stat(session, 'test')
			.then((stat) => {
				checkFileStat(stat);
				expect(stat.name).to.equal('test');
				expect(stat.isDir).to.be.true;
				expect(stat.mime).to.equal('application/directory');
			});
		});

		it('gives stats on a file', function() {
			return connector.stat(session, 'test/unifile-ftp.js')
			.then((stat) => {
				checkFileStat(stat);
				expect(stat.name).to.equal('unifile-ftp.js');
				expect(stat.isDir).to.be.false;
				expect(stat.mime).to.equal('application/javascript');
			});
		});
	});

	describe('mkdir()', function() {
		let connector;
		before('Create folder', function() {
			return Fs.mkdirPromised('tmp');
		});

		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('throws an error if the path already exist', function() {
			return expect(connector.mkdir(session, 'tmp')).to.be.rejectedWith('EEXIST');
		});

		it('creates a new directory', function() {
			return connector.mkdir(session, 'tmp2')
			.then(() => {
				Fs.statPromised('tmp2').should.be.fulfilled;
			});
		});

		after('Cleaning', function() {
			return Promise.all([
				Fs.rmdirPromised('tmp'),
				Fs.rmdirPromised('tmp2')
			]);
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('writes into a file', function() {
			return connector.writeFile(session, 'tmp.test', data)
			.then(() => {
				return Fs.readFilePromised('tmp.test', 'utf8').should.become(data);
			});
		});

		it('writes into a file with a Buffer', function() {
			return connector.writeFile(session, 'tmp.test', Buffer.from(data))
			.then(() => {
				return Fs.readFilePromised('tmp.test', 'utf8').should.become(data);
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync('tmp.test');
		});
	});

	describe('createWriteStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream(session, 'tmp.test');
			expect(stream).to.be.an.instanceof(Writable);
			// Wait for 'end' (not 'finish') to be sure it has been consumed
			stream.on('end', () => {
				return Fs.readFilePromised('tmp.test', 'utf8')
				.then((content) => {
					expect(content).to.equal(data);
					done();
				})
				.catch((err) => done(err));
			});
			stream.on('error', done);
			stream.end(data);
		});

		after('Cleaning', function() {
			Fs.unlinkSync('tmp.test');
		});
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';

		before('Create the file', function() {
			return Fs.writeFilePromised('tmp.test', data);
		});

		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile(session, 'aouoeuoeu')).to.be.rejectedWith('ENOENT');
		});

		it('returns the content of a file', function() {
			return connector.readFile(session, 'tmp.test')
			.then((content) => {
				expect(content.toString()).to.equal(data);
				expect(content).to.be.an.instanceof(Buffer);
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync('tmp.test');
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';

		before('Create the file', function() {
			Fs.writeFileSync('tmp.test', data);
		});

		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('throws an error if wrong credentials', function(done) {
			const stream = connector.createReadStream({
				host: '127.0.0.1',
				port: '9876',
				user: 'a',
				password: 'a'
			}, 'aouoeuoeu');
			['data', 'end'].forEach((ev) => stream.on(ev, () => done(new Error('Should not emit this event'))));
			stream.on('error', (err) => {
				expect(err.message).to.equal('Invalid credentials');
				done();
			});
		});

		it('creates a readable stream', function(done) {
			const chunks = [];
			const stream = connector.createReadStream(session, 'tmp.test');
			expect(stream).to.be.an.instanceof(Readable);
			stream.on('end', () => {
				expect(Buffer.concat(chunks).toString()).to.equal(data);
				done();
			});
			stream.on('error', done);
			stream.on('data', (content) => chunks.push(content));
		});

		after('Cleaning', function() {
			Fs.unlinkSync('tmp.test');
		});
	});

	describe('rename()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if one of the paths does not exist', function() {
			return expect(connector.rename(session, '/home/test', 'home/test2')).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync('tmp.test', '');
		});

		it('renames a file', function() {
			return connector.rename(session, 'tmp.test', 'tmp.test2')
			.then((content) => {
				expect(() => Fs.statSync('tmp.test')).to.throw('ENOENT');
				expect(Fs.statSync('tmp.test2')).to.exist;
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync('tmp.test2');
		});
	});

	describe('unlink()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink(session, 'tmp.testtest')).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync('tmp.test', '');
		});

		it('deletes a file', function() {
			return connector.unlink(session, 'tmp.test')
			.then((content) => {
				expect(() => Fs.statSync('tmp.test')).to.throw('ENOENT');
			});
		});
	});

	describe('rmdir()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir(session, 'tmp.testtest')).to.be.rejectedWith('ENOENT');
		});

		before('Create the directory', function() {
			Fs.mkdirSync('tmp.test');
		});

		it('deletes a directory', function() {
			return connector.rmdir(session, 'tmp.test')
			.then((content) => {
				expect(() => Fs.statSync('tmp.test')).to.throw('ENOENT');
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
			connector = new FtpConnector({redirectUri: '/redirect'});
		});

		it('executes action in order', function() {
			return connector.batch(session, creation)
			.then(() => {
				expect(Fs.statSync('tmp')).to.exist;
				expect(() => Fs.statSync('tmp/a')).to.throw('ENOENT');
				expect(Fs.statSync('tmp/b')).to.exist;

				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(() => Fs.statSync('tmp')).to.throw('ENOENT');
			});
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: 'unknown_file'});
			return connector.batch(session, creation)
			.then(() => {
				expect(Fs.statSync('tmp')).to.exist;
				expect(() => Fs.statSync('tmp/a')).to.throw('ENOENT');
				expect(Fs.statSync('tmp/b')).to.exist;

				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(() => Fs.statSync('tmp')).to.throw('ENOENT');
			});
		});
	});

	after('Tear down', function() {
		return srv.close().then(() => srv = null);
	});
});
