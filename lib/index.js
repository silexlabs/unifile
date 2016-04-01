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

  // OAuth commands

  login(connectorName, loginInfos) {
    return this.callMethod(connectorName, 'login', loginInfos);
  }

  getAuthorizeURL(connectorName) {
    return this.callMethod(connectorName, 'getAuthorizeURL');
  }

  // Filesystem commands

  readdir(connectorName, path) {
    return this.callMethod(connectorName, 'readdir', path);
  }

  mkdir(connectorName, path) {
    return this.callMethod(connectorName, 'mkdir', path);
  }

  writeFile(connectorName, path, content) {
    return this.callMethod(connectorName, 'writeFile', [path, content]);
  }

  createWriteStream(connectorName, path, content) {
    return this.callMethod(connectorName, 'createWriteStream', path);
  }

  readFile(connectorName, path) {
    return this.callMethod(connectorName, 'readFile', path);
  }

  createReadStream(connectorName, path, content) {
    return this.callMethod(connectorName, 'createReadStream', path);
  }

  rename(connectorName, source, destination) {
    return this.callMethod(connectorName, 'rename', [source, destination]);
  }

  unlink(connectorName, path) {
    return this.callMethod(connectorName, 'unlink', path);
  }

  rmdir(connectorName, path) {
    return this.callMethod(connectorName, 'rmdir', path);
  }

  callMethod(connectorName, methodName, params) {
    console.log(connectorName, methodName, params);
    if (!this.connectors.has(connectorName)) throw new Error(`Unknown connector: ${connectorName}`);
    var conn = this.connectors.get(connectorName);
    if (!methodName in conn) throw new Error(`This connector does not implement ${methodName}()`);
    if(Array.isArray(params)){
    console.log('params', ...params);
      return this.connectors.get(connectorName)[methodName](...params);
    }
    else
      return this.connectors.get(connectorName)[methodName](params);
  }
}

module.exports = Unifile;
