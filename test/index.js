'use strict';

const PassThrough = require('stream').PassThrough;
const chai = require('chai');
const Promise = require('bluebird');

const Unifile = require('../lib');

const expect = chai.expect;

describe('Unifile class', function() {
  describe('constructor', function() {
    it('create a new instance with empty config', function() {
      var unifile = new Unifile();
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
      var fn = function() { unifile.use({}); };
      expect(fn).to.throw(/Connector must have a name/);
    });

    it('register a new connector', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      expect(unifile.connectors.size).to.equal(1);
      expect(unifile.connectors.get(connector.name)).to.deep.equal(connector);
    });
  });

  describe('getAuthorizeURL()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.getAuthorizeURL({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.getAuthorizeURL({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the getAuthorizeURL function of the connector', function() {
      var connector = {name: 'test', getAuthorizeURL: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.getAuthorizeURL({}, connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('login()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.login({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.login({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the login function of the connector', function() {
      var connector = {name: 'test', login: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.login({}, connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('readdir()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.readdir({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.readdir({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the readdir function of the connector', function() {
      var connector = {name: 'test', readdir: function() {return new Promise.resolve();}};
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
      var fn = function() { unifile.mkdir({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.mkdir({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the mkdir function of the connector', function() {
      var connector = {name: 'test', mkdir: function() {return new Promise.resolve();}};
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
      var fn = function() { unifile.writeFile({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.writeFile({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', writeFile: function() {return new Promise.resolve();}};
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
      var fn = function() { unifile.createWriteStream({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.createWriteStream({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', createWriteStream: function() {return new PassThrough();}};
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
      var fn = function() { unifile.readFile({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.readFile({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', readFile: function() {return new Promise.resolve();}};
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
      var fn = function() { unifile.createReadStream({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.createReadStream({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', createReadStream: function() {return new PassThrough();}};
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
      var fn = function() { unifile.rename({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.rename({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', rename: function() {return new Promise.resolve();}};
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
      var fn = function() { unifile.unlink({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.unlink({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', unlink: function() {return new Promise.resolve();}};
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
      var fn = function() { unifile.rmdir({});};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.use(connector);
      var fn = function() { unifile.rmdir({}, connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the writeFilefunction of the connector', function() {
      var connector = {name: 'test', rmdir: function() {return new Promise.resolve();}};
      unifile.use(connector);
      expect(unifile.rmdir({}, connector.name)).to.be.an.instanceof(Promise);
    });
  });
});
