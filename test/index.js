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

  describe('authorize()', function() {
    var unifile;
    beforeEach('Instanciation', function() {
      unifile = new Unifile();
    });

    it('throws an error if connectorName is undefined', function() {
      var fn = function() { unifile.authorize();};
      expect(fn).to.throw(/Unknown connector/);
    });

    it('throws an error if connector does not implement it', function() {
      var connector = {name: 'test'};
      unifile.useConnector(connector);
      var fn = function() { unifile.authorize(connector.name); };
      expect(fn).to.throw(/This connector does not implement/);
    });

    it('returns a promise of the authorize function of the connector', function() {
      var connector = {name: 'test', authorize: function() {return new Promise.resolve();}};
      unifile.useConnector(connector);
      expect(unifile.authorize(connector.name)).to.be.an.instanceof(Promise);
    });
  });
});
