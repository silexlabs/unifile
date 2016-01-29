'use strict';

class Unifile {

  constructor(config) {
    this.config = config;
    this.connectors = new Map();
  }

  useConnector(connector) {
    if (!connector) throw new Error('Connector cannot be undefined');
    if (!connector.name) throw new Error('Connector must have a name');
    this.connectors.set(connector.name, connector);
  }

  login(connectorName, loginInfos) {
    if (!this.connectors.has(connectorName)) throw new Error('Unknown connector', connectorName);
    var conn = this.connectors.get(connectorName);
    if (!conn.login) throw new Error('This connector does not implement login()');
    return this.connectors.get(connectorName).login(loginInfos);
  }

  getAuthorizeURL(connectorName) {
    if (!this.connectors.has(connectorName)) throw new Error('Unknown connector', connectorName);
    var conn = this.connectors.get(connectorName);
    if (!conn.getAuthorizeURL) throw new Error('This connector does not implement getAuthorizeURL()');
    return this.connectors.get(connectorName).getAuthorizeURL();
  }

  ls(connectorName, path) {
    if (!this.connectors.has(connectorName)) throw new Error('Unknown connector', connectorName);
    var conn = this.connectors.get(connectorName);
    if (!conn.ls) throw new Error('This connector does not implement ls()');
    return this.connectors.get(connectorName).ls(path);
  }

  mkdir(connectorName, path) {
    if (!this.connectors.has(connectorName)) throw new Error('Unknown connector', connectorName);
    var conn = this.connectors.get(connectorName);
    if (!conn.mkdir) throw new Error('This connector does not implement mkdir()');
    return this.connectors.get(connectorName).mkdir(path);
  }

  put(connectorName, path, content) {
    if (!this.connectors.has(connectorName)) throw new Error('Unknown connector', connectorName);
    var conn = this.connectors.get(connectorName);
    if (!conn.put) throw new Error('This connector does not implement put()');
    return this.connectors.get(connectorName).put(path, content);
  }
}

module.exports = Unifile;
