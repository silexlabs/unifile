'use strict';

const Path = require('path');
const Os = require('os');
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

function createDefaultConnector() {
	return new FsConnector({sandbox: [Os.homedir(), Os.tmpdir()]});
}

describe.only('FsConnector', function() {
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

			connector = new FsConnector({sandbox: [Os.homedir()]});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal([Os.homedir()]);
			expect(connector.rootPath).to.equal(Os.homedir());

			connector = new FsConnector({sandbox: [Os.homedir(), 'a']});
			expect(connector.sandbox).to.be.an.instanceof(Array);
			expect(connector.sandbox).to.deep.equal([Os.homedir(), 'a']);
			expect(connector.rootPath).to.equal(Os.homedir());
		});

		it('sets a rootPath even if a sandbox is set', function() {
			const connector = new FsConnector({sandbox: [Os.homedir(), '/usr'], rootPath: '/etc'});
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
			connector = new FsConnector({sandbox: [Os.homedir()]});
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readdir({}, Path.join(Os.homedir(), 'test'))).to.be.rejectedWith('ENOENT');
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.readdir({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('lists files in the directory with proper entry infomations', function() {
			const checkFiles = (list) => {
				expect(list).to.be.an.instanceof(Array);
				list.every((file) => {
					const keys = Object.keys(file);
					return ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key));
				}).should.be.true;
			};
			return connector.readdir({}, Os.homedir())
			.then(checkFiles)
			// Try with relative path and rootPath
			.then(() => {
				connector.rootPath = Os.homedir();
				return connector.readdir({}, '.');
			})
			.then(checkFiles);
		});

		it('lists files in any directory if sandbox is empty', function() {
			const connector = new FsConnector({sandbox: []});
			return connector.readdir({}, Os.tmpdir())
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
				Fs.writeFileSync(Path.join(Os.tmpdir(), '/.test'));
				connector.showHiddenFile = true;
				return connector.readdir({}, Os.tmpdir());
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
			connector = new FsConnector({sandbox: [Os.homedir(), __dirname], rootPath: Path.dirname(__dirname)});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.stat({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.stat({}, Path.join(Os.homedir(), 'test'))).to.be.rejectedWith('ENOENT');
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
			const connector = new FsConnector({});
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
		const dirname = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = createDefaultConnector();
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.mkdir({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('throws an error if the path already exist', function() {
			return expect(connector.mkdir({}, Os.homedir())).to.be.rejectedWith('EEXIST');
		});

		it('creates a new directory', function() {
			return connector.mkdir({}, Path.join(Os.tmpdir(), dirname))
			.then(() => {
				Fs.statSync(Path.join(Os.tmpdir(), dirname)).should.exist;
			});
		});

		after('Cleaning', function() {
			Fs.rmdirSync(Path.join(Os.tmpdir(), dirname));
		});
	});

	describe('writeFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		const filename = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: Os.tmpdir()});
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.writeFile({}, '/test', data)).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('writes into a file', function() {
			return connector.writeFile({}, Path.join(Os.tmpdir(), filename), data)
			.then(() => {
				Fs.statSync(Path.join(Os.tmpdir(), filename)).should.exist;
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync(Path.join(Os.tmpdir(), filename));
		});
	});

	describe('createWriteStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		const filename = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: Os.tmpdir()});
		});

		it('throws an error if the path is not in the sandbox', function() {
			return expect(() => connector.createWriteStream({}, '/test')).to.throw('Path is out of the sandbox');
		});

		it('creates a writable stream', function(done) {
			const stream = connector.createWriteStream({}, Path.join(Os.tmpdir(), filename));
			expect(stream).to.be.an.instanceof(Writable);
			stream.on('finish', () => {
				Fs.readFileSync(Path.join(Os.tmpdir(), filename), 'utf8').should.equal(data);
				done();
			});
			stream.on('error', done);
			stream.write(data);
			stream.end();
		});

		after('Cleaning', function() {
			Fs.unlinkSync(Path.join(Os.tmpdir(), filename));
		});
	});

	describe('readFile()', function() {
		let connector;
		const data = 'lorem ipsum';
		const filename = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = createDefaultConnector();
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.readFile({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.readFile({}, Path.join(Os.homedir(), 'test'))).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync(Path.join(Os.tmpdir(), filename), data);
		});

		it('returns the content of a file', function() {
			return connector.readFile({}, Path.join(Os.tmpdir(), filename))
			.then((content) => {
				expect(content.toString()).to.equal(data);
				expect(content).to.be.an.instanceof(Buffer);
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync(Path.join(Os.tmpdir(), filename));
		});
	});

	describe('createReadStream()', function() {
		let connector;
		const data = 'lorem ipsum';
		const filename = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = new FsConnector({sandbox: Os.tmpdir()});
		});

		it('throws an error if the path is not in the sandbox', function() {
			return expect(() => connector.createReadStream({}, '/test')).to.throw('Path is out of the sandbox');
		});

		before('Create the file', function() {
			Fs.writeFileSync(Path.join(Os.tmpdir(), filename), data);
		});

		it('creates a readable stream', function(done) {
			const stream = connector.createReadStream({}, Path.join(Os.tmpdir(), filename));
			expect(stream).to.be.an.instanceof(Readable);
			stream.on('end', done);
			stream.on('error', done);
			stream.on('data', (content) => expect(content).to.equal(data));
		});

		after('Cleaning', function() {
			Fs.unlinkSync(Path.join(Os.tmpdir(), filename));
		});
	});

	describe('rename()', function() {
		let connector;
		const filename = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = createDefaultConnector();
		});

		it('rejects the promise if one of the paths is not in the sandbox', function() {
			return expect(connector.rename({}, '/test', Os.homedir())).to.be.rejectedWith('Path is out of the sandbox')
			.then(() => expect(connector.rename({}, Os.homedir(), '/test')).to.be.rejectedWith('Path is out of the sandbox'))
			.then(() => expect(connector.rename({}, '/test', '/usr')).to.be.rejectedWith('Path is out of the sandbox'));
		});

		it('rejects the promise if one of the paths does not exist', function() {
			return expect(connector.rename({}, Path.join(Os.homedir(), 'test'), 'home/test2')).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync(Path.join(Os.tmpdir(), filename), '');
		});

		it('renames a file', function() {
			return connector.rename({}, Path.join(Os.tmpdir(), filename), Path.join(Os.tmpdir(), '/test2'))
			.then((content) => {
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), filename))).to.throw('ENOENT');
				expect(Fs.statSync(Path.join(Os.tmpdir(), '/test2'))).to.exist;
			});
		});

		after('Cleaning', function() {
			Fs.unlinkSync(Path.join(Os.tmpdir(), '/test2'));
		});
	});

	describe('unlink()', function() {
		let connector;
		const filename = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = createDefaultConnector();
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.unlink({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.unlink({}, Path.join(Os.tmpdir(), '/testtest'))).to.be.rejectedWith('ENOENT');
		});

		before('Create the file', function() {
			Fs.writeFileSync(Path.join(Os.tmpdir(), filename), '');
		});

		it('deletes a file', function() {
			return connector.unlink({}, Path.join(Os.tmpdir(), filename))
			.then((content) => {
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), filename))).to.throw('ENOENT');
			});
		});
	});

	describe('rmdir()', function() {
		let connector;
		const dirname = 'test' + Date.now();
		beforeEach('Instanciation', function() {
			connector = createDefaultConnector();
		});

		it('rejects the promise if the path is not in the sandbox', function() {
			return expect(connector.rmdir({}, '/test')).to.be.rejectedWith('Path is out of the sandbox');
		});

		it('rejects the promise if the path does not exist', function() {
			return expect(connector.rmdir({}, Path.join(Os.tmpdir(), '/testtest'))).to.be.rejectedWith('ENOENT');
		});

		before('Create the directory', function() {
			Fs.mkdirSync(Path.join(Os.tmpdir(), dirname));
		});

		it('deletes a directory', function() {
			return connector.rmdir({}, Path.join(Os.tmpdir(), dirname))
			.then((content) => {
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), dirname))).to.throw('ENOENT');
			});
		});
	});

	describe('batch()', function() {
		let connector;
		const dirname = 'test' + Date.now();
		const creation = [
			{name: 'mkdir', path: Path.join(Os.tmpdir(), dirname)},
			{name: 'writeFile', path: Path.join(Os.tmpdir(), dirname, '/a'), content: 'aaa'},
			{name: 'rename', path: Path.join(Os.tmpdir(), dirname, '/a'), destination: Path.join(Os.tmpdir(), dirname, '/b')}
		];
		const destruction = [
			{name: 'unlink', path: Path.join(Os.tmpdir(), dirname, '/b')},
			{name: 'rmdir', path: Path.join(Os.tmpdir(), dirname)}
		];
		beforeEach('Instanciation', function() {
			connector = createDefaultConnector();
		});

		it('executes action in order', function() {
			return connector.batch({}, creation)
			.then(() => {
				expect(Fs.statSync(Path.join(Os.tmpdir(), dirname))).to.exist;
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), dirname, '/a'))).to.throw('ENOENT');
				expect(Fs.statSync(Path.join(Os.tmpdir(), dirname, '/b'))).to.exist;

				return connector.batch({}, destruction);
			})
			.then(() => {
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), dirname))).to.throw('ENOENT');
			});
		});

		it('executes action in order and ignores unsupported ones', function() {
			creation.unshift({name: 'createReadStream', path: Path.join(Os.tmpdir(), dirname)});
			return connector.batch({}, creation)
			.then(() => {
				expect(Fs.statSync(Path.join(Os.tmpdir(), dirname))).to.exist;
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), dirname, '/a'))).to.throw('ENOENT');
				expect(Fs.statSync(Path.join(Os.tmpdir(), dirname, '/b'))).to.exist;

				return connector.batch({}, destruction);
			})
			.then(() => {
				expect(() => Fs.statSync(Path.join(Os.tmpdir(), dirname))).to.throw('ENOENT');
			});
		});
	});
});
