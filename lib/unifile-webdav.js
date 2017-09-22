'use strict';

const Url = require('url');
const request = require('request');
const Promise = require('bluebird');
const XmlStream = require('xml-stream');

const Tools = require('./tools');

const NAME = 'webdav';

const callAPI = Symbol('callAPI');

function toFileInfos(stat) {
	const ns = Object.keys(stat)[0].split(':')[0];
	let name = decodeURI(stat[`${ns}:href`]);
	const isDir = stat[`${ns}:propstat`][`${ns}:prop`][`${ns}:resourcetype`][`${ns}:collection`] !== undefined;
	name = name.endsWith('/') ? name.slice(0, -1) : name;
	name = name.split('/').pop();

	return {
		size: stat[`${ns}:propstat`][`${ns}:prop`][`${ns}:getcontentlength`] || 'n/a',
		modified: new Date(stat[`${ns}:propstat`][`${ns}:prop`][`${ns}:getlastmodified`]),
		name: name,
		isDir: isDir,
		mime: isDir ? 'application/directory' : stat[`${ns}:propstat`][`${ns}:prop`][`${ns}:getcontenttype`]
	};
}

/**
 * Service connector for {@link https://en.wikipedia.org/wiki/WebDAV|WebDAV} server.
 */
class WebDavConnector {
	/**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {string} config.redirectUri - URI of the login page
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   */
	constructor(config) {
		if(!config || !config.redirectUri)
			throw new Error('You should at least set a redirectUri for this connector');

		this.redirectUri = config.redirectUri;
		this.infos = Tools.mergeInfos(config.infos, {
			name: NAME,
			displayName: 'WebDAV',
			icon: '../assets/webdav.png',
			description: 'Edit files on a WebDAV server'
		});
		this.name = this.infos.name;
	}

	getInfos(session) {
		return Object.assign({
			isLoggedIn: (session && 'token' in session),
			isOAuth: false,
			username: session.user
		}, this.infos);
	}

	getAuthorizeURL(session) {
		return Promise.resolve(this.redirectUri);
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
		try {
			Object.assign(session, Tools.parseBasicAuth(loginInfos));
			if(!session.protocol) session.protocol = session.protocol = 'http:';
			session.host = `${session.protocol}//${session.host}/`;
		} catch (e) {
			return Promise.reject(e);
		}
		// Check credentials by stating root
		return this.stat(session, '/')
		.catch((err) => {
			throw new Error('Cannot access server. Please check your credentials. ' + err);
		})
		.then(() => Promise.resolve(this.setAccessToken(session, session.user)));
	}

	// Filesystem commands

	readdir(session, path) {
		return this[callAPI](session, path, {}, 'PROPFIND', false, {
			Depth: 1
		})
		.then((list) => {
			return list.reduce((memo, entry, index) => {
				// Don't return the first element as it's '.'
				if(index == 0) return memo;

				memo.push(toFileInfos(entry));
				return memo;
			}, []);
		});
	}

	stat(session, path) {
		return this[callAPI](session, path, {}, 'PROPFIND', false, {
			Depth: 0
		})
		.then((entries) => {
			return toFileInfos(entries[0]);
		});
	}

	mkdir(session, path) {
		return this[callAPI](session, path, {}, 'MKCOL')
		.catch((err) => {
			// Map to a much clearer error code
			if(err.message === 'Method Not Allowed') throw new Error('EEXISTS');
			else throw err;
		});
	}

	writeFile(session, path, data) {
		return this[callAPI](session, path, data, 'PUT');
	}

	createWriteStream(session, path) {
		return this[callAPI](session, path, {}, 'PUT', true);
	}

	readFile(session, path) {
		return this[callAPI](session, path, {}, 'GET');
	}

	createReadStream(session, path) {
		return this[callAPI](session, path, {}, 'GET', true);
	}

	rename(session, src, dest) {
		return this[callAPI](session, src, {}, 'MOVE', false, {
			'Destination': session.host + dest
		});
	}

	unlink(session, path) {
		return this[callAPI](session, path, {}, 'DELETE');
	}

	rmdir(session, path) {
		return this.unlink(session, path);
	}

	batch(session, actions, message) {
		return Tools.simpleBatch(this, session, actions);
	}

	/**
   * Make a call to the WebDAV server
   * @param {Object} session - WebDAV session storage
   * @param {string} path - End point path
   * @param {Object} data - Data to pass. Will be ignored if method is GET
   * @param {string} method - HTTP verb to use
   * @param {boolean} [isStream=false] - Use the API as a stream
   * @param {Object} [headers={}] - Additionals headers to send
   * @return {Promise|Stream} a Promise of the result send by server or a stream to the endpoint
   * @private
   */
	[callAPI](session, path, data, method, isStream = false, headers = {}) {
		const url = Url.parse(session.host + path);
		if(session.port) url.port = session.port;
		const opts = {
			url: url,
			method: method,
			auth: {
				user: session.user,
				password: session.password
			},
			headers: headers
		};


		if(isStream) {
			const reqStream = request(opts);
			return reqStream.on('response', (res) => {
				if(res.statusCode >= 400) {
					reqStream.emit('error', new Error(res.statusMessage));
				}
			});
		} else {
			if(Object.keys(data).length !== 0) opts.body = data;
			return new Promise((resolve, reject) => {
				const req = request(opts);
				req.on('error', (err) => reject(err));
				req.on('response', (res) => {
					if(res.statusCode >= 400) {
						const error = new Error(res.statusMessage);
						error.statusCode = res.statusCode;
						res.pipe(process.stdout);
						reject(error);
					} else if(res.statusCode === 201) {
						resolve();
					} else if(res.headers['content-type'] && res.headers['content-type'].includes('application/xml')) {
						const results = [];
						const resStream = new XmlStream(req);
						['D:response', 'd:response'].forEach((tagName) => {
							resStream.on(`endElement: ${tagName}`, (item) => {
								results.push(item);
							});
						});
						resStream.on('end', () => resolve(results));
					} else {
						const chunks = [];
						res.on('data', (chunk) => chunks.push(chunk));
						res.on('end', () => {
							return resolve(Buffer.concat(chunks));
						});
					}
				});
			});
		}
	}
}

module.exports = WebDavConnector;
