'use strict';

const Path = require('path');
const Promise = require('bluebird');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const {Readable, Writable} = require('stream');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const FtpSrv = require('ftp-srv');
const FileSystem = require('../node_modules/ftp-srv/src/fs.js');

const FtpConnector = require('../lib/unifile-ftp');

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

describe('FtpConnector', function() {
  this.slow(200);

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
    fs.list = function(path = '.') {
      return Fs.readdirPromised(path)
      .map((entry) => {
        return Fs.statPromised(Path.resolve(path, entry))
        .then((stat) => {
          stat.name = entry;
          return stat;
        });
      })
      .then((entries) => {
        // Adds . folder
        return Fs.statPromised(path)
        .then((stat) => {
          stat.name = '.';
          entries.push(stat);
          return entries;
        });
      });
    };

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
      return expect(connector.login({}, 'ftp://toto:roro@0.0.0.0:9876')).to.be.rejectedWith('Wrong credentials');
    });

    it('accepts a string as login infos', function() {
      const session = {};
      return connector.login(session, 'ftp://admin:admin@0.0.0.0:9876')
      .then(() => {
        expect(session.host).to.equal('0.0.0.0');
        expect(session.port).to.equal('9876');
        expect(session.user).to.equal('admin');
        expect(session.password).to.equal('admin');
      });
    });

    it('accepts an object as login infos', function() {
      const session = {};
      return connector.login(session, {
        host: '0.0.0.0',
        port: '9876',
        user: 'admin',
        password: 'admin'
      })
      .then(() => {
        expect(session.host).to.equal('0.0.0.0');
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
      return expect(connector.readdir(session, '/home/test')).to.be.rejectedWith('ENOENT');
    });

    it('lists files in the directory with proper entry infomations', function() {
      return connector.readdir(session, 'test')
        .then((list) => {
          expect(list).to.be.an.instanceof(Array);
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
      connector = new FtpConnector({redirectUri: '/redirect'});
    });

    it('rejects the promise if the path does not exist', function() {
      return expect(connector.stat(session, '/home/test')).to.be.rejectedWith('ENOENT');
    });

    it('gives stats on a directory', function() {
      return connector.stat(session, 'test')
        .then((stat) => {
          expect(stat).to.be.an.instanceof(Object);
          const keys = Object.keys(stat);
          ['isDir', 'mime', 'modified', 'name', 'size'].every((key) => keys.includes(key))
            .should.be.true;
        });
    });

    it('gives stats on a file', function() {
      return connector.stat(session, 'test/unifile-ftp.js')
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
        Fs.statPromised('tmp2').should.be.fullfilled;
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
        Fs.readFilePromised('tmp.test', 'utf8').should.become(data);
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
        return Fs.readFilePromised('tmp.test', 'utf8').should.become(data)
        .then(() => done());
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

    it('rejects the promise if an error occurs', function() {
      const fakeFtpClient = {
        get: function(path, callback) {
          callback(null, new Readable({
            read(size) {
              this.emit('error', new Error('Something bad happened'));
              return;
            }
          }));
        },
        end: function() {}
      };
      return expect(connector.readFile(session, '/home/test', fakeFtpClient))
      .to.be.rejectedWith('Something bad happened');
    });

    it('returns the content of a file', function() {
      return connector.readFile(session, 'tmp.test').should.become(data);
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
        host: '0.0.0.0',
        port: '9876',
        user: 'a',
        password: 'a'
      }, 'aouoeuoeu');
      ['data', 'end'].forEach((ev) => stream.on(ev, () => done(new Error('Should not emit this event'))));
      stream.on('error', (err) => {
        expect(err.message).to.equal('Wrong credentials');
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
