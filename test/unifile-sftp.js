'use strict';

const {Readable, Writable} = require('stream');
const Promise = require('bluebird');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const Path = require('path');
const Chai = require('chai');
const Pem = require('pem');
Chai.use(require('chai-as-promised'));
const {Server, SFTP_STATUS_CODE} = require('ssh2');
const SFTPClient = require('sftp-promises');

const SftpConnector = require('../lib/unifile-sftp');

const expect = Chai.expect;
Chai.should();

console.warn = function() {};

const sftpDefaultInfos = {
	name: 'sftp',
	displayName: 'SFTP',
	icon: '',
	description: 'Edit files on a SSH server.'
};

describe('SFTPConnector', function() {
	this.slow(200);

	let srv = null;
	let privateKey = null;
	const session = {
		host: '127.0.0.1',
		user: 'admin',
		port: 9876,
		password: 'admin'
	};

	before('Create server key', function(done) {
		Pem.createPrivateKey((err, key) => {
			privateKey = key;
			done(err);
		});
	});

	beforeEach('Instanciation', function(done) {
		let reading = false;
		srv = new Server({hostKeys: [privateKey]}, (client) => {
			client.on('authentication', (ctx) => {
				if(ctx.method === 'password' && ctx.username === session.user
								&& ctx.password === session.password)
					ctx.accept();
				else ctx.reject();
			})
			.on('ready', () => {
				client.on('session', (accept, reject) => {
					const session = accept();
					session.on('sftp', (accept, reject) => {
						const sftpStream = accept();
						sftpStream.on('OPEN', (reqid, filename, flags, attrs) => {
							sftpStream.handle(reqid, new Buffer(filename));
						})
						.on('STAT', (reqid, path) => {
							Fs.statPromised(path)
							.catch((err) => sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE))
							.then((stats) => sftpStream.attrs(reqid, stats));
						})
						.on('FSTAT', (reqid, handle) => {
							Fs.statPromised(handle.toString())
							.catch((err) => sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE))
							.then((stats) => sftpStream.attrs(reqid, stats));
						})
						.on('RENAME', (reqid, oldPath, newPath) => {
							Fs.renamePromised(oldPath, newPath)
							.then(() => sftpStream.status(reqid, SFTP_STATUS_CODE.OK))
							.catch((e) => {
								if(e.code === 'ENOENT')
									sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
								else
									sftpStream.status(reqid, SFTP_STATUS_CODE.FAILURE);
							});
						})
						.on('REMOVE', (reqid, path) => {
							Fs.unlinkPromised(path)
							.then(() => sftpStream.status(reqid, SFTP_STATUS_CODE.OK))
							.catch((e) => {
								if(e.code === 'ENOENT')
									sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
								else
									sftpStream.status(reqid, SFTP_STATUS_CODE.FAILURE);
							});
						})
						.on('RMDIR', (reqid, path) => {
							Fs.rmdirPromised(path)
							.then(() => sftpStream.status(reqid, SFTP_STATUS_CODE.OK))
							.catch((e) => {
								if(e.code === 'ENOENT')
									sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
								else
									sftpStream.status(reqid, SFTP_STATUS_CODE.FAILURE);
							});
						})
						.on('OPENDIR', (reqid, path) => {
							sftpStream.handle(reqid, new Buffer(path));
						})
						.on('READDIR', (reqid, handle) => {
							if(reading) {
								reading = false;
								return sftpStream.status(reqid, SFTP_STATUS_CODE.EOF);
							}

							const path = handle.toString();
							reading = true;
							return Fs.readdirPromised(path)
							.map((entry) => {
								return Fs.statPromised(Path.join(path, entry))
								.then((stats) => {
									return {filename: entry, attrs: stats, longname: (stats.isDirectory() ? 'd' : '') + entry};
								});
							})
							.then((list) => {
								sftpStream.name(reqid, list);
							})
							.catch((err) => {
								sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
							});
						})
						.on('READ', (reqid, handle, offset, length) => {
							const path = handle.toString();
							if(reading) {
								reading = false;
								return sftpStream.status(reqid, SFTP_STATUS_CODE.EOF);
							}
							reading = true;
							if(path === 'empty') sftpStream.data(reqid, null);
							else Fs.readFilePromised(handle.toString())
							.then((data) => sftpStream.data(reqid, data))
							.catch((e) => {
								if(e.code === 'ENOENT')
									sftpStream.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
								else
									sftpStream.status(reqid, SFTP_STATUS_CODE.FAILURE);
							});
						})
						.on('WRITE', (reqid, handle, offset, data) => {
							const path = handle.toString();
							Fs.writeFilePromised(path, data)
							.then(() => {
								sftpStream.status(reqid, SFTP_STATUS_CODE.OK);
							})
							.catch((e) => {
								if(path === '/test/unknown') sftpStream.status(reqid, SFTP_STATUS_CODE.BAD_MESSAGE);
								else sftpStream.status(reqid, SFTP_STATUS_CODE.FAILURE);
							});
							return false;
						})
						.on('MKDIR', (reqid, path, attrs) => {
							Fs.mkdirPromised(path)
							.then(() => sftpStream.status(reqid, SFTP_STATUS_CODE.OK))
							.catch((e) => {
								if(path === '/test/unknown') sftpStream.status(reqid, SFTP_STATUS_CODE.BAD_MESSAGE);
								else sftpStream.status(reqid, SFTP_STATUS_CODE.FAILURE);
							});
						})
						.on('SETSTAT', (reqid, path, attrs) => {
							sftpStream.status(reqid, SFTP_STATUS_CODE.OK);
						})
						.on('FSETSTAT', (reqid, path, attrs) => {
							sftpStream.status(reqid, SFTP_STATUS_CODE.OK);
						})
						.on('CLOSE', (reqid, handle) => {
							sftpStream.status(reqid, SFTP_STATUS_CODE.OK);
						});
					});
				});
			});
		})
		.listen(session.port, session.host, () => {
			done();
		});
	});

	describe('constructor', function() {
		it('throws an error with empty config', function() {
			expect(() => new SftpConnector()).to.throw('You should at least set a redirectUri');
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
				const connector = new SftpConnector(config);
				expect(connector).to.exist;
				Object.keys(connector.infos).forEach((info) => {
					if(info !== key)
						expect(connector.infos[info]).to.equal(sftpDefaultInfos[info]);
					else
						expect(connector.infos[info]).to.equal(overrides[info]);
				});
				if(key === 'name')
					expect(connector.name).to.equal(overrides.name);
				else
					expect(connector.name).to.equal(sftpDefaultInfos.name);
			});
		});

		it('ignores invalid infos', function() {
			const connector = new SftpConnector({infos: 3, redirectUri: 'a'});
			expect(connector.infos).to.deep.equal(sftpDefaultInfos);
		});
	});

	describe('getInfos()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: 'a'});
		});

		it('returns an infos object', function() {
			const infos = connector.getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(sftpDefaultInfos.name);
			expect(infos.displayName).to.equal(sftpDefaultInfos.displayName);
			expect(infos.icon).to.equal(sftpDefaultInfos.icon);
			expect(infos.description).to.equal(sftpDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.undefined;
		});

		it('returns a customed infos object is told so', function() {
			const infos = new SftpConnector({infos: {icon: 'ooo'}, redirectUri: 'a'}).getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(sftpDefaultInfos.name);
			expect(infos.displayName).to.equal(sftpDefaultInfos.displayName);
			expect(infos.icon).to.equal('ooo');
			expect(infos.description).to.equal(sftpDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.false;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.undefined;
		});
	});

	describe('getAuthorizeURL()', function() {
		const redirectUri = '/redirect';
		let connector;
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: redirectUri});
		});

		it('returns a promise for the redirect URI', function() {
			expect(connector.getAuthorizeURL({})).to.become(redirectUri);
		});
	});

	describe('setAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
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
			connector = new SftpConnector({redirectUri: '/redirect'});
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
			connector = new SftpConnector({redirectUri: '/redirect'});
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
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
			return Fs.mkdirPromised('testReaddir')
			.then(() => Fs.writeFilePromised('testReaddir/test1.txt', 'lorem'))
			.then(() => Fs.writeFilePromised('testReaddir/test2.txt', 'ipsum'))
			.then(() => Fs.writeFilePromised('testReaddir/.testHidden.txt', 'lorem'))
			.then(() => Fs.mkdirPromised('testReaddir/testDir'));
		});

		it('rejects the promise if it cannot connect to host', function() {
			return expect(connector.readdir({
				host: 'http://127.0.0.1/',
				user: 'a',
				password: 'a'
			}, '/home/test')).to.be.rejectedWith('ENOTFOUND');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readdir(session, '/home/test')).to.be.rejectedWith('path does not exist');
		});

		it('rejects the promise if the path is a file', function() {
			return expect(connector.readdir(session, __filename)).to.be.rejectedWith('Target is not a directory');
		});

		it('lists files at root when provided with an empty path', function() {
			return connector.readdir(session, '')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
			});
		});

		it('lists files in the directory with proper entry infomations', function() {
			return connector.readdir(session, 'testReaddir')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.equal(3);
				list.forEach((file) => expect(file).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']));
			});
		});

		it('lists hidden files too when told so', function() {
			connector.showHiddenFile = true;
			return connector.readdir(session, 'testReaddir')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				expect(list.length).to.equal(4);
				list.forEach((file) => expect(file).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']));
			});
		});

		it('reuses a session if one is given', function() {
			const sftp = new SFTPClient();
			return sftp.session(session)
			.then((sftpSession) => {
				return connector.readdir(session, 'testReaddir', sftpSession)
				.then((list) => {
					expect(list).to.be.an.instanceof(Array);
					expect(list.length).to.equal(3);
					list.forEach((file) => expect(file).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']));
					sftpSession.end();
				});
			});
		});

		afterEach('Clean up', function() {
			return Fs.unlinkPromised('testReaddir/test1.txt')
			.then(() => Fs.unlinkPromised('testReaddir/test2.txt'))
			.then(() => Fs.unlinkPromised('testReaddir/.testHidden.txt'))
			.then(() => Fs.rmdirPromised('testReaddir/testDir'))
			.then(() => Fs.rmdirPromised('testReaddir'));
		});
	});

	describe('stat()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat(session, '/home/test')).to.be.rejectedWith('path does not exist');
		});

		it('gives stats on root if provided with an empty path', function() {
			return connector.stat(session, '')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				expect(stat).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']);
			});
		});

		it('gives stats on a directory', function() {
			return connector.stat(session, __dirname)
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				expect(stat).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']);
			});
		});

		it('gives stats on a file', function() {
			return connector.stat(session, __filename)
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				expect(stat).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']);
			});
		});

		it('reuses a session if one is given', function() {
			const sftp = new SFTPClient();
			return sftp.session(session)
			.then((sftpSession) => {
				return connector.stat(session, __filename, sftpSession)
				.then((stat) => {
					expect(stat).to.be.an.instanceof(Object);
					expect(stat).to.have.all.keys(['isDir', 'mime', 'modified', 'name', 'size']);
					sftpSession.end();
				});
			});
		});
	});

	describe('mkdir()', function() {
		let connector;

		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
			return Fs.mkdirPromised('testMkdirExists');
		});

		it('throws an error if the path already exist', function() {
			return expect(connector.mkdir(session, 'testMkdirExists')).to.be.rejectedWith('already exist');
		});

		it('throws an error if the parent does not exist', function() {
			return expect(connector.mkdir(session, '/test/tttt')).to.be.rejectedWith('Unable to create remote dir');
		});

		it('throws an error if anything bad happen', function() {
			return expect(connector.mkdir(session, '/test/unknown')).to.be.rejectedWith('Bad message');
		});

		it('creates a new directory', function() {
			return connector.mkdir(session, 'newDir')
			.then(() => {
				return expect(Fs.statPromised('newDir')).to.be.fulfilled;
			})
			.then(() => Fs.rmdirPromised('newDir'));
		});

		afterEach('Cleanup', function() {
			return Fs.rmdirPromised('testMkdirExists');
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
		});

		it('throws an error if the parent does not exist', function() {
			return expect(connector.writeFile(session, '/test/tt', data)).to.be.rejectedWith('Unable to create remote file');
		});

		it('throws an error if anything bad happen', function() {
			return expect(connector.writeFile(session, '/test/unknown', data)).to.be.rejectedWith('Bad message');
		});

		it('writes into a file', function() {
			return connector.writeFile(session, 'tmp.test', data)
			.then(() => Fs.readFilePromised('tmp.test', 'utf8').should.become(data))
			.then(() => Fs.unlinkPromised('tmp.test'));
		});

		it('writes into a file with a Buffer', function() {
			return connector.writeFile(session, 'tmp.test', Buffer.from(data))
			.then(() => Fs.readFilePromised('tmp.test', 'utf8').should.become(data))
			.then(() => Fs.unlinkPromised('tmp.test'));
		});
	});

	describe('createWriteStream()', function() {
		this.timeout(3000);
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
		});

		it('emits an error if something\'s wrong', function(done) {
			const badSession = Object.assign({}, session, {username: 'aaa'});
			const stream = connector.createWriteStream(badSession, '/auo/aoeuoeu/tmp.test');
			stream.on('error', (err) => {
				expect(err).to.be.an.instanceof(Error);
				expect(err.message).to.equal('All configured authentication methods failed');
				done();
			});

			stream.on('drain', () => done(new Error('Should not be here')));

			stream.end(data);
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream(session, 'tmp.test');
			expect(stream).to.be.an.instanceof(Writable);
			// Wait for 'close' (not 'finish') to be sure it has been consumed
			stream.on('close', () => {
				return Fs.readFilePromised('tmp.test', 'utf8')
				.then((result) => {
					expect(result).to.equal(data);
				})
				.then(() => Fs.unlinkPromised('tmp.test'))
				.then(() => done())
				// Needed because the promise would catch the expect thrown exception
				.catch(done);
			});
			stream.on('error', done);
			stream.end(data);
		});

		it('reuses a session if one is given', function(done) {
			const sftp = new SFTPClient();
			sftp.session(session)
			.then((sftpSession) => {
				const stream = connector.createWriteStream(session, 'tmp.test', sftpSession);
				expect(stream).to.be.an.instanceof(Writable);
				// Wait for 'close' (not 'finish') to be sure it has been consumed
				stream.on('close', () => {
					sftpSession.end();
					Fs.readFilePromised('tmp.test', 'utf8')
					.then((result) => {
						expect(result).to.equal(data);
					})
					.then(() => Fs.unlinkPromised('tmp.test'))
					.then(() => done())
					// Needed because the promise would catch the expect thrown exception
					.catch(done);
				});
				stream.on('error', done);
				stream.end(data);
			});
		});
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';

		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
			return Fs.writeFilePromised('testRead.txt', data);
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile(session, 'aouoeuoeu')).to.be.rejectedWith('path does not exist');
		});

		it('returns the content of a file', function() {
			return connector.readFile(session, 'testRead.txt')
			.then((content) => {
				expect(content.toString()).to.equal(data);
				expect(content).to.be.an.instanceof(Buffer);
			});
		});

		it('reuses a session if one is given', function() {
			const sftp = new SFTPClient();
			return sftp.session(session)
			.then((sftpSession) => {
				return connector.readFile(session, 'testRead.txt', sftpSession)
				.then((content) => {
					expect(content.toString()).to.equal(data);
					expect(content).to.be.an.instanceof(Buffer);
					return sftpSession.end();
				});
			});
		});

		afterEach('Cleanup', function() {
			return Fs.unlinkPromised('testRead.txt');
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';

		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
			return Fs.writeFilePromised('testReadStream.txt', data);
		});

		it('throws an error if wrong credentials', function(done) {
			const badSession = Object.assign({}, session, {username: 'aaa'});
			const stream = connector.createReadStream(badSession, 'aouoeuoeu');
			stream.on('error', (err) => {
				expect(err).to.be.an.instanceof(Error);
				expect(err.message).to.equal('All configured authentication methods failed');
				done();
			});
			stream.on('data', () => {
				done(new Error('Should not emit this event'));
			});
		});

		it('throws an error if the path does not exist', function(done) {
			const stream = connector.createReadStream(session, 'aouoeuoeu');
			stream.on('error', (err) => {
				expect(err.message).to.equal('No such file or directory');
				done();
			});
			stream.on('data', () => {
				done(new Error('Should not emit this event'));
			});
		});

		it('creates a readable stream', function(done) {
			const chunks = [];
			const stream = connector.createReadStream(session, 'testReadStream.txt');
			expect(stream).to.be.an.instanceof(Readable);
			stream.on('end', () => {
				expect(Buffer.concat(chunks).toString()).to.equal(data);
				done();
			});
			stream.on('error', done);
			stream.on('data', (content) => chunks.push(content));
		});

		it('reuses a session if one is given', function(done) {
			const sftp = new SFTPClient();
			sftp.session(session)
			.then((sftpSession) => {
				const chunks = [];
				const stream = connector.createReadStream(session, 'testReadStream.txt', sftpSession);
				expect(stream).to.be.an.instanceof(Readable);
				stream.on('end', () => {
					expect(Buffer.concat(chunks).toString()).to.equal(data);
					sftpSession.end();
					done();
				});
				stream.on('error', done);
				stream.on('data', (content) => chunks.push(content));
			});
		});

		afterEach('Cleanup', function() {
			return Fs.unlinkPromised('testReadStream.txt');
		});
	});

	describe('rename()', function() {
		let connector;
		before('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
			return Fs.writeFilePromised('testRename.txt', 'lorem ipsum');
		});

		it('rejects the promise if one of the paths does not exist', function() {
			return expect(connector.rename(session, '/home/test', 'home/test2')).to.be.rejectedWith('path does not exist');
		});

		it('renames a file', function() {
			return connector.rename(session, 'testRename.txt', 'testRename2.txt')
			.then((content) => {
				return Fs.readFilePromised('testRename.txt').should.be.rejectedWith('ENOENT');
			})
			.then(() => {
				return Fs.readFilePromised('testRename2.txt', 'utf8').should.become('lorem ipsum')
				.then(() => Fs.unlinkPromised('testRename2.txt'));
			});
		});
	});

	describe('unlink()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
			return Fs.writeFilePromised('testUnlink.txt', 'lorem ipsum');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink(session, 'tmp.testtest')).to.be.rejectedWith('path does not exist');
		});

		it('deletes a file', function() {
			return connector.unlink(session, 'testUnlink.txt')
			.then((content) => {
				return expect(Fs.statPromised('testUnlink.txt')).to.be.rejectedWith('ENOENT');
			});
		});
	});

	describe('rmdir()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new SftpConnector({redirectUri: '/redirect'});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir(session, 'tmp.testtest')).to.be.rejectedWith('path does not exist');
		});

		it('deletes a directory', function() {
			return Fs.mkdirPromised('testRmdir')
			.then(() => connector.rmdir(session, 'testRmdir'))
			.then((content) => {
				return expect(Fs.statPromised('testRmdir')).to.be.rejectedWith('ENOENT');
			});
		});
	});

	describe('batch()', function() {
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
			connector = new SftpConnector({redirectUri: '/redirect'});
		});

		it('executes action in order', function() {
			return connector.batch(session, creation)
			.then(() => {
				expect(Fs.readFilePromised(session, 'tmp/b')).to.become('aaa');
				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(Fs.statPromised(session, 'tmp')).to.be.rejectedWith('path does not exist');
			});
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: 'unknown_file'});
			return connector.batch(session, creation)
			.then(() => {
				expect(Fs.readFilePromised(session, 'tmp/b')).to.become('aaa');
				return connector.batch(session, destruction);
			})
			.then(() => {
				expect(Fs.statPromised(session, 'tmp')).to.be.rejectedWith('path does not exist');
			});
		});
	});

	afterEach('Tear down', function(done) {
		return srv.close(done);
	});
});
