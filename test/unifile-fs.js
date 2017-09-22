'use strict';

const Path = require('path');
const Fs = require('fs');
const {Readable, Writable} = require('stream');
const chai = require('chai');
chai.use(require('chai-as-promised'));

const FsConnector = require('../lib/unifile-fs');

const expect = chai.expect;
chai.should();

const fsDefaultInfos = {
	name: 'fs',
	displayName: 'Local',
	icon: '',
	description: 'Edit files on your local drive.'
};

describe('FsConnector', function() {
	describe('constructor', function() {
		it('create a new instance with empty config', function() {
			const connector = new FsConnector();
			expect(connector).to.exist;
			expect(connector.infos).to.deep.equal(fsDefaultInfos);
			expect(connector.name).to.equal('fs');
		});

		it('overrides infos when given in config', function() {
			const overrides = {
				name: 'aaa',
				displayName: 'bbb',
				icon: 'ccc',
				description: 'dddd'
			};
			Object.keys(overrides).forEach((key) => {
				const config = {infos: {}};
				config.infos[key] = overrides[key];
				const connector = new FsConnector(config);
				expect(connector).to.exist;
				Object.keys(connector.infos).forEach((info) => {
					if(info !== key)
						expect(connector.infos[info]).to.equal(fsDefaultInfos[info]);
					else
						expect(connector.infos[info]).to.equal(overrides[info]);
				});
				if(key === 'name')
					expect(connector.name).to.equal(overrides.name);
				else
					expect(connector.name).to.equal(fsDefaultInfos.name);
			});
		});

		it('ignores invalid infos', function() {
			const connector = new FsConnector({infos: 3});
			expect(connector.infos).to.deep.equal(fsDefaultInfos);
		});

		it('creates a sandbox from a string', function() {
			let connector = new FsConnector({sandbox: ''});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal([]);

			connector = new FsConnector({sandbox: '/'});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal(['/']);
			expect(connector.rootPath).to.equal('/');

			connector = new FsConnector({sandbox: new String('/a')});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox.length).to.equal(1);
		});

		it('creates a sandbox from an array', function() {
			let connector = new FsConnector({sandbox: []});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal([]);

			connector = new FsConnector({sandbox: ['/home']});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal(['/home']);
			expect(connector.rootPath).to.equal('/home');

			connector = new FsConnector({sandbox: ['/home', 'a']});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal(['/home', 'a']);
			expect(connector.rootPath).to.equal('/home');
		});

		it('sets a rootPath even if a sandbox is set', function() {
			const connector = new FsConnector({sandbox: ['/home', '/usr'], rootPath: '/etc'});
			expect(connector.rootPath).to.equal('/etc');
		});

		it('throws an error if sandbox is nor a string nor an array', function() {
			expect(() => {
				new FsConnector({sandbox: 1});
			}).to.throw('Invalid sandbox path. Must be a string or an array');
		});
	});

	describe('getInfos()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector();
		});

		it('returns an infos object', function() {
			const infos = connector.getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(fsDefaultInfos.name);
			expect(infos.displayName).to.equal(fsDefaultInfos.displayName);
			expect(infos.icon).to.equal(fsDefaultInfos.icon);
			expect(infos.description).to.equal(fsDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.true;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.equal(process.env.USER);
		});

		it('returns a customed infos object is told so', function() {
			const infos = new FsConnector({infos: {icon: 'ooo'}}).getInfos({});
			expect(infos).to.be.an.instanceof(Object);
			expect(infos.name).to.equal(fsDefaultInfos.name);
			expect(infos.displayName).to.equal(fsDefaultInfos.displayName);
			expect(infos.icon).to.equal('ooo');
			expect(infos.description).to.equal(fsDefaultInfos.description);
			expect(infos.isLoggedIn).to.be.true;
			expect(infos.isOAuth).to.be.false;
			expect(infos.username).to.be.equal(process.env.USER);
		});
	});

	describe('getAuthorizeURL()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector();
		});

		it('returns a promise for an empty string', function() {
			expect(connector.getAuthorizeURL({})).to.become('');
		});
	});

	describe('setAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector();
		});

		it('returns a promise of the token', function() {
			const token = 'token';
			expect(connector.setAccessToken({}, token)).to.become(token);
		});
	});

	describe('clearAccessToken()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector();
		});

		it('returns an empty promise', function() {
			return expect(connector.clearAccessToken({})).to.be.fulfilled;
		});
	});

	describe('login()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector();
		});

		it('returns an empty promise', function() {
			return expect(connector.login({}, 'anything')).to.be.fulfilled;
		});
	});

	describe('readdir()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/home']});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.readdir({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readdir({}, '/home/test')).to.be.rejectedWith('ENOENT');
		});

		it('lists files in the directory with proper entry infomations', function() {
			const checkFiles = (list) => {
				expect(list).to.be.an.instanceof(Array);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			};
			return connector.readdir({}, __dirname)
			.then(checkFiles)
			// Try with relative path and rootPath
			.then(() => {
				connector.rootPath = __dirname;
				return connector.readdir({}, '.');
			})
			.then(checkFiles);
		});

		it('lists files in any directory if sandbox is empty', function() {
			const connector = new FsConnector({sandbox: []});
			return connector.readdir({}, '/tmp')
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				list.every((file) => {
					// Hidden file stay hidden by default
					file.name.startsWith('.').should.be.false;
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			})
			.then(() => {
				Fs.writeFileSync('/tmp/.test');
				connector.showHiddenFile = true;
				return connector.readdir({}, '/tmp');
			})
			.then((list) => {
				expect(list).to.be.an.instanceof(Array);
				list.some((file) => file.name.startsWith('.')).should.be.true;
			});
		});
	});

	describe('stat()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/home'], rootPath: Path.dirname(__dirname)});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.stat({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat({}, '/home/test')).to.be.rejectedWith('ENOENT');
		});

		it('gives stats on an entry with proper infomations', function() {
			return connector.stat({}, 'test')
			.then((stat) => {
				expect(stat).to.be.an.instanceof(Object);
				const keys = Object.keys(stat);
				['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
				.should.be.true;
			});
		});

		it('gives stat of any file if sandbox is empty', function() {
			const connector = new FsConnector({sandbox: ['/']});
			return connector.stat({}, '/')
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
			connector = new FsConnector({sandbox: ['/home', '/tmp']});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.mkdir({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('throws an error if the path already exist', function() {
			return expect(connector.mkdir({}, '/home')).to.be.rejectedWith('EEXIST');
		});

		it('creates a new directory', function() {
			return connector.mkdir({}, '/tmp/test')
			.then(() => {
				Fs.statSync('/tmp/test').should.exist;
			});
		});

		after('Cleaning', function() {
			Fs.rmdirSync('/tmp/test');
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: '/tmp'});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.writeFile({}, '/test', data)).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('writes into a file', function() {
			return connector.writeFile({}, '/tmp/test', data)
			.then(() => {
				Fs.statSync('/tmp/test').should.exist;
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync('/tmp/test');
		});
	});

	describe('createWriteStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: '/tmp'});
		});

		it('throws an error if the path is not in the sandbox', function() {
			return expect(() => connector.createWriteStream({}, '/test')).to.throw('Path is out of the sandbox');
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream({}, '/tmp/test');
			expect(stream).to.be.an.instanceof(Writable);
			stream.on('finish', () => {
				Fs.readFileSync('/tmp/test', 'utf8').should.equal(data);
				done();
			});
			stream.on('error', done);
			stream.write(data);
			stream.end();
		});

		after('Cleaning', function() {
			Fs.unlinkSync('/tmp/test');
		});
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/tmp', '/home']});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.readFile({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile({}, '/home/test')).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync('/tmp/test', data);
		});

		it('returns the content of a file', function() {
			return connector.readFile({}, '/tmp/test')
			.then((content) => {
				expect(content.toString()).to.equal(data);
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync('/tmp/test');
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: '/tmp'});
		});

		it('throws an error if the path is not in the sandbox', function() {
			return expect(() => connector.createReadStream({}, '/test')).to.throw('Path is out of the sandbox');
		});

		before('Create the file', function() {
			Fs.writeFileSync('/tmp/test', data);
		});

		it('creates a readable stream', function(done) {
			const stream = connector.createReadStream({}, '/tmp/test');
			expect(stream).to.be.an.instanceof(Readable);
			stream.on('end', done);
			stream.on('error', done);
			stream.on('data', (content) => expect(content).to.equal(data));
		});

		after('Cleaning', function() {
			Fs.unlinkSync('/tmp/test');
		});
	});

	describe('rename()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/tmp', '/home']});
		});

		it('rejects the promise if one of the paths is not in the sandbox', function() {
			return expect(connector.rename({}, '/test', '/home')).to.be.rejectedWith('Path is out of the sandbox')
			.then(() => expect(connector.rename({}, '/home', '/test')).to.be.rejectedWith('Path is out of the sandbox'))
			.then(() => expect(connector.rename({}, '/test', '/usr')).to.be.rejectedWith('Path is out of the sandbox'));
		});

		it('rejects the promise if one of the paths does not exist', function() {
			return expect(connector.rename({}, '/home/test', 'home/test2')).to.be.rejectedWith('ENOENT')
			.then(() => expect(connector.rename({}, '/tmp', 'home/test2')).to.be.rejectedWith('ENOENT'));
		});

		before('Create the file', function() {
			Fs.writeFileSync('/tmp/test', '');
		});

		it('renames a file', function() {
			return connector.rename({}, '/tmp/test', '/tmp/test2')
			.then((content) => {
				expect(() => Fs.statSync('/tmp/test')).to.throw('ENOENT');
				expect(Fs.statSync('/tmp/test2')).to.exist;
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync('/tmp/test2');
		});
	});

	describe('unlink()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/tmp', '/home']});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.unlink({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink({}, '/tmp/testtest')).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync('/tmp/test', '');
		});

		it('deletes a file', function() {
			return connector.unlink({}, '/tmp/test')
			.then((content) => {
				expect(() => Fs.statSync('/tmp/test')).to.throw('ENOENT');
			});
		});
	});

	describe('rmdir()', function() {
		let connector;
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/tmp', '/home']});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.rmdir({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir({}, '/tmp/testtest')).to.be.rejectedWith('ENOENT');
		});

		before('Create the directory', function() {
			Fs.mkdirSync('/tmp/test');
		});

		it('deletes a directory', function() {
			return connector.rmdir({}, '/tmp/test')
			.then((content) => {
				expect(() => Fs.statSync('/tmp/test')).to.throw('ENOENT');
			});
		});
	});

	describe('batch()', function() {
		let connector;
		const creation = [
			{name: 'mkdir', path: '/tmp/test'},
			{name: 'writeFile', path: '/tmp/test/a', content: 'aaa'},
			{name: 'rename', path: '/tmp/test/a', destination: '/tmp/test/b'}
		];
		const destruction = [
			{name: 'unlink', path: '/tmp/test/b'},
			{name: 'rmdir', path: '/tmp/test'}
		];
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: ['/tmp', '/home']});
		});

		it('executes action in order', function() {
			return connector.batch({}, creation)
			.then(() => {
				expect(Fs.statSync('/tmp/test')).to.exist;
				expect(() => Fs.statSync('/tmp/test/a')).to.throw('ENOENT');
				expect(Fs.statSync('/tmp/test/b')).to.exist;

				return connector.batch({}, destruction);
			})
			.then(() => {
				expect(() => Fs.statSync('/tmp/test')).to.throw('ENOENT');
			});
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: '/tmp/test'});
			return connector.batch({}, creation)
			.then(() => {
				expect(Fs.statSync('/tmp/test')).to.exist;
				expect(() => Fs.statSync('/tmp/test/a')).to.throw('ENOENT');
				expect(Fs.statSync('/tmp/test/b')).to.exist;

				return connector.batch({}, destruction);
			})
			.then(() => {
				expect(() => Fs.statSync('/tmp/test')).to.throw('ENOENT');
			});
		});
	});
});
