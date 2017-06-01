'use strict';

const Promise = require('bluebird');

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
