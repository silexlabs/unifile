/** @namespace Unifile */
'use strict';

/**
 * The built-in Node.js WritableStream class
 * @external WritableStream
 * @see https://nodejs.org/api/stream.html#stream_writable_streams
 */

/**
 * The built-in Node.js ReadableStream class
 * @external ReadableStream
 * @see https://nodejs.org/api/stream.html#stream_readable_streams
 */

/**
 * Bluebird Promise class
 * @external Promise
 * @see http://bluebirdjs.com/docs/api-reference.html
 */

/**
 * State of the connector
 * @typedef {Object} ConnectorState
 * @property {boolean} isLoggedIn - Flag wether the user is logged in.
 * @property {boolean} isOAuth - Flag wether the connector uses OAuth as authentication mechanism.
 * @property {string} username - Name used to log in.
 */

/**
 * Static infos of the connector
 * @typedef {Object} ConnectorStaticInfos
 * @property {string} name - ID of the connector. This will be use to select the connector in unifile.
 * @property {string} displayName - Name that should be display. Allows characters forbidden in name.
 * @property {string} icon - Path to an icon for this connector.
 * @property {string} description - Description of the connector.
 */

/**
 * Representation of a connector infos
 * @typedef {Object} ConnectorInfos
 * @todo Use ConnectorState and ConnectorStaticInfos docs
 * @property {string} name - ID of the connector. This will be use to select the connector in unifile.
 * @property {string} displayName - Name that should be display. Allows characters forbidden in name.
 * @property {string} icon - Path to an icon for this connector.
 * @property {string} description - Description of the connector.
 * @property {boolean} isLoggedIn - Flag wether the user is logged in.
 * @property {boolean} isOAuth - Flag wether the connector uses OAuth as authentication mechanism.
 * @property {string} username - Name used to log in.
 */

/**
 * Credentials of a service
 * @typedef {Object} Credentials
 *
 * For non-OAuth services
 * @property {string} [host] - URL to the service
 * @property {string} [port] - Port the auth service is listening to
 * @property {string} [user] - Username for the service
 * @property {string} [password] - Password for the service
 *
 * For OAuth services
 * @property {string} [code] - OAuth code for the service
 * @property {string} [state] - OAuth state for the service
 */

/**
 * Representation of a file
 * @typedef {Object} FileInfos
 * @property {string} name - Name of the file
 * @property {number} size - Size of the file in bytes
 * @property {string} modified - ISO string representation of the date from last modification
 * @property {boolean} isDir - Wether this is a directory or not
 * @property {string} mime - MIME type of this file
 */

const {UnifileError} = require('./error.js');

/**
 * Tells if a method needs authentification
 * @param {string} methodName - Name of the method to test
 * @return {boolean} true if the method needs to be authenticated
 * @private
 */
function isAuthentifiedFunction(methodName) {
	return ['readdir', 'mkdir', 'writeFile', 'createWriteStream',
		'readFile', 'createReadStream', 'rename', 'unlink', 'rmdir',
		'stat', 'batch'].includes(methodName);
}

const connectors = Symbol('connectors');

/**
 * Unifile class
 * This will use connectors to distant services to manipulate the files.
 * An empty instance of Unifile cannot connect to any service. You must first call the use() function
 * to register a connector.
 */
class Unifile {

	/**
   * Create a new instance of Unifile.
   * This will regroup all the connectors you decided to use.
   * @constructor
   */
	constructor() {
		this[connectors] = new Map();
	}

	/**
   * Adds a new connector into Unifile.
   * Once a connector has been register with this function, it can be used with all the commands.
   * @param {Connector} connector - A connector implementing all of Unifile functions
   */
	use(connector) {
		if(!connector) throw new Error('Connector cannot be undefined');
		if(!connector.name) throw new Error('Connector must have a name');
		this[connectors].set(connector.name.toLowerCase(), connector);
	}

	// Infos commands

	/**
   * Get all the info you need about a connector
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {ConnectorInfos} all the infos about this connector
   */
	getInfos(session, connectorName) {
		return this.callMethod(connectorName, session, 'getInfos');
	}

	/**
   * List all the connectors currently used in this instance of Unifile
   * @return {string[]} an array of connectors names
   */
	listConnectors() {
		return Array.from(this[connectors].keys());
	}

	// Auth commands

	/**
   * Log a connector in a distant service.
   * This must be called before any access to the service or an error will be thrown.
   * The result of a successful login attempt will be saved in the session.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {Credentials|string} credentials - Service credentials (user/password or OAuth code)
   *  or a authenticated URL to connect to the service.
   * @return {external:Promise<string|null>} a promise of OAuth token if the service uses it or null
   */
	login(session, connectorName, credentials) {
		return this.callMethod(connectorName, session, 'login', credentials);
	}

	/**
   * Log a connector by directly using a OAuth token.
   * You don't have to call the method if you use the login() method. This is only in the case
   * you got a token from anothe source (CLI, app,...)
   * This must be called before any access to the service or an error will be thrown.
   * The result of a successful login attempt will be saved in the session.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} token - Service access token generated by OAuth
   * @return {external:Promise<string|null>} a promise of OAuth token if the service uses it or null
   */
	setAccessToken(session, connectorName, token) {
		return this.callMethod(connectorName, session, 'setAccessToken', token);
	}

	/**
   * Log out from a connector.
   * After that you won't be able to make any request until you log in again.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {external:Promise<null>} an empty promise.
   */
	clearAccessToken(session, connectorName) {
		return this.callMethod(connectorName, session, 'clearAccessToken');
	}

	/**
   * Get the URL of the authorization endpoint for an OAuth service.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {external:Promise<string>} a promise of the authorization URL
   */
	getAuthorizeURL(session, connectorName) {
		return this.callMethod(connectorName, session, 'getAuthorizeURL');
	}

	// Filesystem commands

	/**
   * Reads the content of a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the directory to read. Must be relative to the root of the service.
   * @return {external:Promise<FileInfos[]>} a promise of an array of FileInfos
   * @see {@link FileInfos} to get the properties of the return objects
   */
	readdir(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'readdir', path);
	}

	/**
   * Give information about a file or directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the object to stat. Must be relative to the root of the service.
   * @return {external:Promise<FileInfos>} a promise of FileInfos
   * @see {@link FileInfos} to get the properties of the return object
   */
	stat(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'stat', path);
	}

	/**
   * Create a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the directory to create. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise
   */
	mkdir(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'mkdir', path);
	}

	/**
   * Write content to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the file to write. Must be relative to the root of the service.
   * @param {string} content - Content to write into the file
   * @return {external:Promise<null>} an empty promise.
   */
	writeFile(session, connectorName, path, content) {
		return this.callMethod(connectorName, session, 'writeFile', path, content);
	}

	/**
   * Create a write stream to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the file to write. Must be relative to the root of the service.
   * @return {external:WritableStream} a writable stream into the file
   */
	createWriteStream(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'createWriteStream', path);
	}

	/**
   * Read the content of the file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the file to read. Must be relative to the root of the service.
   * @return {external:Promise<string>} a promise of the content of the file
   */
	readFile(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'readFile', path);
	}

	/**
   * Create a read stream to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the file to read. Must be relative to the root of the service.
   * @return {external:ReadableStream} a readable stream from the file
   */
	createReadStream(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'createReadStream', path);
	}

	/**
   * Rename a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} source - Path to the file to rename. Must be relative to the root of the service.
   * @param {string} destination - New path to give to the file. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
	rename(session, connectorName, source, destination) {
		return this.callMethod(connectorName, session, 'rename', source, destination);
	}

	/**
   * Unlink (delete) a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the file to delete. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
	unlink(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'unlink', path);
	}

	/**
   * Remove a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} path - Path of the directory to delete. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
	rmdir(session, connectorName, path) {
		return this.callMethod(connectorName, session, 'rmdir', path);
	}

	// Batch operation
	/**
   * Execute batch operation.
   * Available actions are UNLINK, RMDIR, RENAME, MKDIR and WRITEFILE.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {Object[]} actions - Array of actions to execute in this batch.
   * @param {string} actions[].name - Name of this action.
   * @param {string} actions[].path - Path parameter for this action.
   * @param {string} [actions[].destination] - Destination parameter for this action.
   * @param {string} [actions[].content] - Content parameter for this action.
   * @param {string} [message] - Message to describe this batch
   * @return {external:Promise<null>} an empty promise.
   */
	batch(session, connectorName, actions, message) {
		return this.callMethod(connectorName, session, 'batch', actions, message);
	}

	// Privates

	callMethod(connectorName, session, methodName, ...params) {
		// Check connector
		if(!connectorName)
			return Promise.reject(new UnifileError(UnifileError.EINVAL, 'You should specify a connector name!'));
		const name = connectorName.toLowerCase();
		if(!this[connectors].has(name))
			return Promise.reject(new UnifileError(UnifileError.EINVAL, `Unknown connector: ${connectorName}`));
		const connector = this[connectors].get(name);
		if(!(methodName in connector))
			return Promise.reject(new UnifileError(UnifileError.EINVAL, `This connector does not implement ${methodName}()`));

		// Check session
		if(!session)
			return Promise.reject(new UnifileError(UnifileError.EINVAL, 'No session provided'));
		else if(!(name in session)) session[name] = {};

		// Check authentification
		if(isAuthentifiedFunction(methodName) && !connector.getInfos(session[name]).isLoggedIn)
			return Promise.reject(new UnifileError(UnifileError.EACCES, 'User not logged in.'));

		return connector[methodName](session[name], ...params);
	}
}

// Register out-of-the-box plugins
Unifile.GitHubConnector = require('./unifile-github.js');
Unifile.DropboxConnector = require('./unifile-dropbox.js');
Unifile.FtpConnector = require('./unifile-ftp.js');
Unifile.RemoteStorageConnector = require('./unifile-remoteStorage.js');
Unifile.FsConnector = require('./unifile-fs.js');
Unifile.SftpConnector = require('./unifile-sftp.js');

module.exports = Unifile;
