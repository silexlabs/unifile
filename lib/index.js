'use strict';

class Unifile {

  constructor() {
    this.connectors = new Map();
  }

  use(connector) {
    if (!connector) throw new Error('Connector cannot be undefined');
    if (!connector.name) throw new Error('Connector must have a name');
    this.connectors.set(connector.name.toLowerCase(), connector);
  }

  // OAuth commands

  login(session, connectorName, loginInfos) {
    return this.callMethod(connectorName, session, 'login', loginInfos);
  }

  setBasicAuth(session, connectorName, username, password){
    return this.callMethod(connectorName, session, 'setBasicAuth', username, password);
  }

  setAccessToken(session, connectorName, token){
    return this.callMethod(connectorName, session, 'setAccessToken', token);
  }

  clearAccessToken(session, connectorName){
    return this.callMethod(connectorName, session, 'clearAccessToken');
  }

  getAuthorizeURL(session, connectorName) {
    return this.callMethod(connectorName, session, 'getAuthorizeURL');
  }

  // Filesystem commands

  readdir(session, connectorName, path) {
    return this.callMethod(connectorName, session, 'readdir', path);
  }

  mkdir(session, connectorName, path) {
    return this.callMethod(connectorName, session, 'mkdir', path);
  }

  writeFile(session, connectorName, path, content) {
    return this.callMethod(connectorName, session, 'writeFile', path, content);
  }

  createWriteStream(session, connectorName, path, content) {
    return this.callMethod(connectorName, session, 'createWriteStream', path);
  }

  readFile(session, connectorName, path) {
    return this.callMethod(connectorName, session, 'readFile', path);
  }

  createReadStream(session, connectorName, path, content) {
    return this.callMethod(connectorName, session, 'createReadStream', path);
  }

  rename(session, connectorName, source, destination) {
    return this.callMethod(connectorName, session, 'rename', source, destination);
  }

  unlink(session, connectorName, path) {
    return this.callMethod(connectorName, session, 'unlink', path);
  }

  rmdir(session, connectorName, path) {
    return this.callMethod(connectorName, session, 'rmdir', path);
  }

  // Batch operation
  batch(session, connectorName, actions){
    return this.callMethod(connectorName, session, 'batch', path);
  }

  // Privates

  callMethod(connectorName, session, methodName, ...params) {
    let name = connectorName.toLowerCase();
    if (!this.connectors.has(name)) throw new Error(`Unknown connector: ${connectorName}`);
    let connector = this.connectors.get(name);
    if (!(methodName in connector)) throw new Error(`This connector does not implement ${methodName}()`);
    if(!(name in session)) session[name] = {};
    return connector[methodName](session[name], ...params);
  }
}

module.exports = Unifile;
