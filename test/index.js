'use strict';

const PassThrough = require('stream').PassThrough;
const chai = require('chai');
const Promise = require('bluebird');

const Unifile = require('../lib');

const expect = chai.expect;

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

  describe('use()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connector is undefined', function() {
      expect(unifile.use).to.throw(/Connector cannot be undefined/);
    });

    it('throws an error if connector does not have a name', function() {
      const fn = function() { unifile.use({}); };
      expect(fn).to.throw(/Connector must have a name/);
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
      const fn = function() { unifile.getInfos();};
      expect(fn).to.throw(/You should specify a connector name!/);
    });

    it('throws an error if connectorName is not registered', function() {
      const fn = function() { unifile.getInfos('test');};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      const connector = {name: 'test'};
      unifile.use(connector);
      const fn = function() { unifile.getInfos(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns an infos object', function() {
      const connector = {name: 'test', getInfos: function() {return {name: this.name};}};
      unifile.use(connector);
      const infos = unifile.getInfos(connector.name);
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
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      const connector = {name: 'test'};
      unifile.use(connector);
      const fn = function() { unifile.getAuthorizeURL({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the getAuthorizeURL function of the connector', function() {
      const connector = {name: 'test', getAuthorizeURL: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.getAuthorizeURL({}, connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('setBasicAuth()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      const fn = function() { unifile.setBasicAuth({});};
      expect(fn).to.throw(/You should specify a connector name!/);
    });

    it('throws an error if connectorName is not registered', function() {
      const fn = function() { unifile.setBasicAuth({}, 'test');};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      const connector = {name: 'test'};
      unifile.use(connector);
      const fn = function() { unifile.setBasicAuth({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the setBasicAuth function of the connector', function() {
      const connector = {name: 'test', setBasicAuth: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.setBasicAuth({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      const connector = {name: 'test'};
      unifile.use(connector);
      const fn = function() { unifile.setAccessToken({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
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
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      const connector = {name: 'test'};
      unifile.use(connector);
      const fn = function() { unifile.clearAccessToken({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
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
      expect(fn).to.throw(/This connector does not implement/);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the readdir function of the connector', function() {
      const connector = {name: 'test', readdir: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.readdir({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the mkdir function of the connector', function() {
      const connector = {name: 'test', mkdir: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.mkdir({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', writeFile: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.writeFile({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', createWriteStream: function() {return new PassThrough();}};
      unifile.use(connector);
      expect(unifile.createWriteStream({}, connector.name)).to.be.an.instanceof(PassThrough);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', readFile: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.readFile({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', createReadStream: function() {return new PassThrough();}};
      unifile.use(connector);
      expect(unifile.createReadStream({}, connector.name)).to.be.an.instanceof(PassThrough);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', rename: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.rename({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', unlink: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.unlink({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', rmdir: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.rmdir({}, connector.name)).to.be.an.instanceof(Promise);
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
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      const connector = {name: 'test', batch: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.batch({}, connector.name)).to.be.an.instanceof(Promise);
    });
  });
});
