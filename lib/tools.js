'use strict';

const Promise = require('bluebird');
const Url = require('url');

/**
 * Merge infos provided by the user with the connector defaults
 * @param {Object} newInfos - Infos provided by the user.
 * @param {Object} defaults - Defaults of the connector.
 * @private
 */
module.exports.mergeInfos = function(newInfos, defaults) {
  let infos;
  if(!newInfos) infos = {};
  else if(typeof newInfos !== 'object') {
    console.warn('Infos must be an object. Provided infos are ignored.');
    infos = {};
  } else infos = newInfos;

  return {
    name: infos.name || defaults.name,
    displayName: infos.displayName || defaults.displayName,
    icon: infos.icon || defaults.icon,
    description: infos.description || defaults.description
  };
};

/**
 * Simple implementation of the batch action
 */
module.exports.simpleBatch = function(connector, session, actions) {
  return Promise.each(actions, (action) => {
    const act = action.name.toLowerCase();
    switch (act) {
      case 'unlink':
      case 'rmdir':
      case 'mkdir':
        connector[act](session, action.path);
        break;
      case 'rename':
        connector[act](session, action.path, action.destination);
        break;
      case 'writefile':
        connector.writeFile(session, action.path, action.content);
        break;
      default:
        console.warn(`Unsupported batch action: ${action.name}`);
    }
  });
};

/**
 * Clear a session by emptying the object
 * @param {Object} session - Session object to clear
 */
module.exports.clearSession = function(session) {
  for(const key in session) delete session[key];
};

/**
 * Parse basic authentication as an Object or a string
 * @param {Qbject|string} auth - Object or string containing auth
 * @return {Credentials} an object with the parsed credentials
 */
module.exports.parseBasicAuth = function(auth) {
  let authConf;
  if(auth.constructor === String) {
    try {
      const url = Url.parse(auth);
      authConf = {
        host: url.hostname,
        port: url.port,
        protocol: url.protocol
      };
      if(!url.auth) throw new Error('No authentication');
      [authConf.user, authConf.password] = url.auth.split(':');
    } catch (e) {
      throw 'Invalid URL. It must contain host, port and authentication';
    }
  } else {
    authConf = auth;
  }
  return authConf;
};
