'use strict';

var chai = require('chai');
var Promise = require('bluebird');

var Unifile = require('../lib');

var expect = chai.expect;

describe('Unifile class', function() {
  describe('constructor', function() {
    it('create a new instance with empty config', function() {
      var unifile = new Unifile();
      expect(unifile).not.to.be.null;
      expect(unifile.connectors).to.be.an.instanceof(Map);
      expect(unifile.connectors.size).to.equal(0);
      expect(unifile.useConnector).to.exist;
    });

    it('create a new instance with config', function() {
      var config = {key: 'value'};
      var unifile = new Unifile(config);
      expect(unifile).not.to.be.null;
      expect(unifile.connectors).to.be.an.instanceof(Map);
      expect(unifile.connectors.size).to.equal(0);
      expect(unifile.config).to.deep.equal(config);
    });
  });

  describe('useConnector()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connector is undefined', function() {
      expect(unifile.useConnector).to.throw(/Connector cannot be undefined/);
    });

    it('throws an error if connector does not have a name', function() {
      var fn = function() { unifile.useConnector({}); };
      expect(fn).to.throw(/Connector must have a name/);
    });

    it('register a new connector', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
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
      var fn = function() { unifile.getAuthorizeURL();};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
      var fn = function() { unifile.getAuthorizeURL(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the getAuthorizeURL function of the connector', function() {
      var connector = {name: 'test', getAuthorizeURL: function() {return new Promise.resolve();}};
      unifile.useConnector(connector);
      expect(unifile.getAuthorizeURL(connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('login()', function(){
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.login();};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
      var fn = function() { unifile.login(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the login function of the connector', function() {
      var connector = {name: 'test', login: function() {return new Promise.resolve();}};
      unifile.useConnector(connector);
      expect(unifile.login(connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('ls()', function(){
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.ls();};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
      var fn = function() { unifile.ls(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the ls function of the connector', function() {
      var connector = {name: 'test', ls: function() {return new Promise.resolve();}};
      unifile.useConnector(connector);
      expect(unifile.ls(connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('mkdir()', function(){
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.mkdir();};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
      var fn = function() { unifile.mkdir(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the mkdir function of the connector', function() {
      var connector = {name: 'test', mkdir: function() {return new Promise.resolve();}};
      unifile.useConnector(connector);
      expect(unifile.mkdir(connector.name)).to.be.an.instanceof(Promise);
    });
  });

  describe('put()', function(){
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.put();};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
      var fn = function() { unifile.put(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the put function of the connector', function() {
      var connector = {name: 'test', put: function() {return new Promise.resolve();}};
      unifile.useConnector(connector);
      expect(unifile.put(connector.name)).to.be.an.instanceof(Promise);
    });
  });
});
