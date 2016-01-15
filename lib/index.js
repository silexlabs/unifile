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


  authorize(connectorName) {
    if (!this.connectors.has(connectorName)) throw new Error('Unknown connector', connectorName);
    var conn = this.connectors.get(connectorName);
    if (!conn.authorize) throw new Error('This connector does not implement authorize()');
    return this.connectors.get(connectorName).authorize();
  }
}

module.exports = Unifile;
