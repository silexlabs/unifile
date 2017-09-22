'use strict';

const Promise = require('bluebird');
const WebFinger = require('webfinger.js');
const request = require('request');
const Mime = require('mime');

const Tools = require('./tools');

const NAME = 'remotestorage';

/**
 * Create the commons option for the API request
 * @param {string} url - URL of the request
 * @param {string} path - Path of the endpoint
 * @param {string} token - Bearer token for OAuth
 * @return {Object} request options
 * @private
 */
function getRequestOptions(url, path, token) {
	return {
		url: url + '/' + path,
		headers: {
			'Authorization': 'Bearer ' + token
		},
		encoding: null
	};
}

/**
 * Performs a GET request to the API
 * @param {string} url - URL of the request
 * @param {string} path - Path of the endpoint
 * @param {string} token - Bearer token for OAuth
 * @param {boolean} isStream - Access the API as a stream or not
 * @return {Promise<Object>} a promise of the body returned
 * @private
 */
function get(url, path, token, isStream = false) {
	const opts = getRequestOptions(url, path, token);
	if(isStream) return request.get(opts);
	else {
		return new Promise(function(resolve, reject) {
			request.get(opts, function(err, res, body) {
				resolve(body);
			});
		});
	}
}

/**
 * Performs a PUT request to the API
 * @param {string} url - URL of the request
 * @param {string} path - Path of the endpoint
 * @param {Object} content - Content of the request body
 * @param {string} token - Bearer token for OAuth
 * @param {boolean} isStream - Access the API as a stream or not
 * @return {Promise<Object>} a promise of the body returned
 * @private
 */
function put(url, path, content, token, isStream = false) {
	const opts = getRequestOptions(url, path, token);
	if(isStream) return request.put(opts);
	else {
		opts.body = content;
		return new Promise(function(resolve, reject) {
			request.put(opts, function(err, res, body) {
				resolve(body);
			});
		});
	}
}

/**
 * Performs a DELETE request to the API
 * @param {string} url - URL of the request
 * @param {string} path - Path of the endpoint
 * @param {string} token - Bearer token for OAuth
 * @return {Promise<Object>} a promise of the body returned
 * @private
 */
function del(url, path, token) {
	const opts = getRequestOptions(url, path, token);
	return new Promise(function(resolve, reject) {
		request.del(opts, function(err, res, body) {
			resolve(body);
		});
	});
}

function toFileInfos(filename, stat) {
	return {
		size: stat['Content-Length'] || 'N/A',
		modified: 'N/A',
		name: filename,
		isDir: filename.endsWith('/'),
		mime: Mime.lookup(filename)
	};
}

/**
 * Service connector for {@link https://remotestorage.io/|remoteStorage} server.
 *
 * This connector use WebFinger to find the endpoint of your server.
 */
class RemoteStorageConnector {
	/**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {string} config.redirectUri - RemoteStorage application redirect URI
   * @param {string} config.userAddress - Url of the user RemoteStorage server.
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   */
	constructor(config) {
		this.config = config;
		this.infos = Tools.mergeInfos(config.infos, {
			name: NAME,
			displayName: 'RemoteStorage',
			icon: '../assets/rs.png',
			description: 'Edit files on a RemoteStorage service'
		});
		this.name = this.infos.name;
	}

	getInfos(session) {
		return Object.assign({
			isLoggedIn: (session && 'token' in session),
			isOAuth: true,
			username: this.config.userAddress
		}, this.infos);
	}

	getAuthorizeURL(session) {
		return new Promise((resolve, reject) => {
			new WebFinger().lookup(session.userAddress, (err, res) => {
				if(err)
					reject(err);
				else {
					const infos = res.object.links[0];
					session.infos = {
						href: infos.href,
						storageType: infos.properties['http://remotestorage.io/spec/version'],
						authURL: infos.properties['http://tools.ietf.org/html/rfc6749#section-4.2'],
						properties: infos.properties
					};
					let query = 'redirect_uri=' + this.config.redirectUri
										+ '&client_id=Unifile'
										+ '&scope=*:rw'
										+ '&response_type=token';
					if(session.infos.authURL.indexOf('?') > -1) query = '&' + query;
					else query = '?' + query;

					resolve(session.infos.authURL + query);
				}
			});
		});
	}

	setAccessToken(session, token) {
		session.token = token;
		return Promise.resolve(token);
	}

	clearAccessToken(session) {
		Tools.clearSession(session);
		return Promise.resolve();
	}

	login(session, loginInfos) {
		if(loginInfos.constructor === String) {
			return this.setAccessToken(session, loginInfos);
		} else {
			return this.setAccessToken(session, loginInfos.token);
		}
	}

	readdir(session, path) {
		if(!path.endsWith('/')) {
			return Promise.reject('Folder path must end with a /.'
								+ 'If you want to see a file content, call readFile() instead');
		} else {
			return get(session.infos.href, path, session.token)
			.then((result) => {
				var obj = JSON.parse(result);
				return Object.keys(obj.items).map((key) => {
					return toFileInfos(key, obj.items[key]);
				});
			});
		}
	}

	stat(session, path) {
		return new Promise(function(resolve, reject) {
			request.get(getRequestOptions(session.infos.href, path, session.token), function(err, res, body) {
				resolve(body, res.headers['content-length']);
			});
		})
		.then((body, size) => {
			var obj = JSON.parse(body);
			return toFileInfos(obj.name, {'Content-Length': size});
		});
	}

	mkdir(session, path) {
		if(!path.endsWith('/')) {
			return Promise.reject('Folder path must end with a /. If you want to create a file, call writeFile() instead');
		} else {
			return put(session.infos.href, path + '/.keep', '', session.token);
		}
	}

	writeFile(session, path, content) {
		if(path.endsWith('/')) {
			return Promise.reject('File path cannot end with a /. If you want to create a folder, call mkdir() instead');
		} else {
			return put(session.infos.href, path, content, session.token);
		}
	}

	createWriteStream(session, path) {
		if(path.endsWith('/')) {
			return Promise.reject('File path cannot end with a /. If you want to create a folder, call mkdir() instead');
		} else {
			return put(session.infos.href, path, null, session.token, true);
		}
	}

	readFile(session, path) {
		if(path.endsWith('/')) {
			return Promise.reject('File path cannot end with a /.'
								+ 'If you want to see a folder listing, call readdir() instead');
		} else {
			return get(session.infos.href, path, session.token);
		}
	}

	createReadStream(session, path) {
		if(path.endsWith('/')) {
			return Promise.reject('File path cannot end with a /.'
								+ 'If you want to see a folder listing, call readdir() instead');
		} else {
			return get(session.infos.href, path, session.token, true);
		}
	}

	rename(session, src, dest) {
		let originContent;
		return get(session.infos.href, src, session.token)
		.then((content) => originContent = content)
		.then(() => del(session.infos.href, src, session.token))
		.then(() => put(session.infos.href, dest, originContent, session.token));
	}

	unlink(session, path) {
		if(path.endsWith('/')) {
			return Promise.reject('File path cannot end with a /. If you want to delete a folder, call rmdir() instead');
		} else {
			return del(session.infos.href, path, session.token);
		}
	}

	rmdir(session, path) {
		if(!path.endsWith('/')) {
			return Promise.reject('Folder path must end with a /. If you want to delete a file, call unlink() instead');
		} else {
			return del(session.infos.href, path + '/.keep', session.token);
		}
	}

	batch(session, actions, message) {
		return Promise.each(actions, (action) => {
			const act = action.name.toLowerCase();
			switch (act) {
				case 'unlink':
				case 'rmdir':
				case 'mkdir':
					this[act](session, action.path);
					break;
				case 'rename':
					this[act](session, action.path, action.destination);
					break;
				case 'writefile':
					this.writeFile(session, action.path, action.content);
					break;
				default:
					console.warn(`Unsupported batch action: ${action.name}`);
			}
		});
	}
}

module.exports = RemoteStorageConnector;
