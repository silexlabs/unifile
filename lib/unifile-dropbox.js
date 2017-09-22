'use strict';

const Promise = require('bluebird');
const request = require('request');
const Mime = require('mime');

const Tools = require('./tools');

const NAME = 'dropbox';
const DB_OAUTH_URL = 'https://www.dropbox.com/oauth2';

/** ehehe
 * Make a call to the Dropbox API
 * @param {Object} session - Dropbox session storage
 * @param {string} path - End point path
 * @param {Object} data - Data to pass. Convert to querystring if method is GET or to the request body
 * @param {string} [subdomain=api] - Subdomain of the endpoint to call (api/content)
 * @param {boolean} [isJson=true] - Whether to stringify the body or not
 * @param {Object} [headers={}] - Override of addition to the request headers
 * @return {Promise} a Promise of the result send by server
 * @private
 */
function callAPI(session, path, data, subdomain = 'api', isJson = true, headers = {}) {
	let authorization;
	if(session.basic) authorization = 'Basic ' + session.basic;
	else authorization = 'Bearer ' + session.token;

	const reqOptions = {
		url: `https://${subdomain}.dropboxapi.com/2${path}`,
		method: 'POST',
		headers: {
			'Authorization': authorization,
			'User-Agent': 'Unifile'
		},
		json: isJson,
		encoding: null
	};

	if(Object.keys(data).length !== 0) reqOptions.body = data;

	if(headers) {
		for(const header in headers) {
			reqOptions.headers[header] = headers[header];
		}
	}

	return new Promise(function(resolve, reject) {
		request(reqOptions, function(err, res, body) {
			if(err) {
				return reject(err);
			}
			if(res.statusCode >= 400) {
				return reject({statusCode: res.statusCode, message: body});
			}
			resolve(body);
		});
	});
}

function openUploadSession(session, data, autoclose) {
	return callAPI(session, '/files/upload_session/start', data, 'content', false, {
		'Content-Type': 'application/octet-stream',
		'Dropbox-API-Arg': JSON.stringify({
			close: autoclose
		})
	})
	.then((result) => JSON.parse(result));
}

/**
 * Close an upload batch session
 * @param {Object} session - Dropbox session
 * @param {Object[]} entries - Files identifiers that have been uploaded during this session
 * @param {Object} entries[].cursor - Upload cursor
 * @param {string} entries[].cursor.session_id - Id of the upload session for this file
 * @param {string} entries[].cursor.offset - The amount of data already transfered
 * @param {string} entries[].commit - Path and modifier for the file
 * @param {string} entries[].commit.path - Path of the file
 * @param {string} entries[].commit.mode - Write mode of the file
 * @param {string} [entries[].commit.autorename=false] - Rename strategy in case of conflict
 * @param {string} [entries[].commit.client_modified] - Force this timestamp as the last modification
 * @param {string} [entries[].commit.mute=false] - Don't notify the client about this change
 * @return {Promise<string, string>} a Promise of an async_job_id or a 'complete' tag
 * @private
 */
function closeUploadBatchSession(session, entries) {
	return callAPI(session, '/files/upload_session/finish_batch', {
		entries: entries
	});
}

function checkBatchEnd(session, result, checkRoute, jobId) {
	let newId = null;
	switch (result['.tag']) {
		case 'async_job_id':
			newId = result.async_job_id;
			// falls through
		case 'in_progress':
			return callAPI(session, checkRoute, {
				async_job_id: newId || jobId
			})
			.then((result) => checkBatchEnd(session, result, checkRoute, jobId));
		case 'complete':
			return Promise.resolve();
	}
}

function makePathAbsolute(path) {
	return path === '' ? path : '/' + path.split('/').filter((token) => token != '').join('/');
}

/**
 * Service connector for {@link https://dropbox.com|Dropbox} plateform.
 *
 * This will need a registered Dropbox application with valid redirection for your server.
 * You can register a new application {@link https://www.dropbox.com/developers/apps|here} and
 * learn more about Dropbox OAuth Web application flow
 * {@link https://www.dropbox.com/developers/reference/oauth-guide|here}
 */
class DropboxConnector {
	/**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {string} config.redirectUri - Dropbox application redirect URI
   * @param {string} config.clientId - Dropbox application client ID
   * @param {string} config.clientSecret - Dropbox application client secret
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   */
	constructor(config) {
		if(!config || !config.clientId || !config.clientSecret || !config.redirectUri)
			throw new Error('Invalid configuration. Please refer to the documentation to get the required fields.');
		this.redirectUri = config.redirectUri;
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;

		this.infos = Tools.mergeInfos(config.infos, {
			name: NAME,
			displayName: 'Dropbox',
			icon: '../assets/dropbox.png',
			description: 'Edit html files from your Dropbox.'
		});

		this.name = this.infos.name;
	}

	getInfos(session) {
		return Object.assign({
			isLoggedIn: (session && 'token' in session),
			isOAuth: true,
			username: session.account ? session.account.name.display_name : ''
		}, this.infos);
	}

	setAccessToken(session, token) {
		session.token = token;
		if(session.account && 'id' in session.account) {
			return callAPI(session, '/users/get_account', {
				account_id: session.account.id
			})
			.then((account) => {
				session.account = account;
				return token;
			});
		} else return Promise.resolve(token);
	}

	clearAccessToken(session) {
		Tools.clearSession(session);
		return Promise.resolve();
	}

	getAuthorizeURL(session) {
		// Generate a random string for the state
		session.state = (+new Date() * Math.random()).toString(36).replace('.', '');
		let url = DB_OAUTH_URL
						+ '/authorize?response_type=code&client_id=' + this.clientId
						+ '&state=' + session.state;

		// For CLI, don't use redirectUri and ask for `code` to be paste in the app
		if(this.redirectUri) url += '&redirect_uri=' + this.redirectUri;

		return Promise.resolve(url);
	}

	login(session, loginInfos) {
		let returnPromise;
		function processResponse(resolve, reject, err, response, body) {
			if(err) return reject('Error while calling Dropbox API. ' + err);
			session.account = {id: body.account_id};
			return resolve(body.access_token);
		}

		if(loginInfos.constructor === String) {
			returnPromise = new Promise((resolve, reject) =>
				request(loginInfos, processResponse.bind(this, resolve, reject)));
		} else if(loginInfos.state !== session.state) {
			return Promise.reject('Invalid request (cross-site request)');
		} else {
			returnPromise = new Promise((resolve, reject) => {
				request({
					url: 'https://api.dropboxapi.com/oauth2/token',
					method: 'POST',
					form: {
						code: loginInfos.code,
						grant_type: 'authorization_code',
						client_id: this.clientId,
						client_secret: this.clientSecret,
						redirect_uri: this.redirectUri
					},
					json: true
				}, processResponse.bind(this, resolve, reject));
			});
		}
		return returnPromise.then((token) => {
			return this.setAccessToken(session, token);
		});
	}

	//Filesystem commands

	readdir(session, path) {
		return callAPI(session, '/files/list_folder', {
			path: makePathAbsolute(path)
		})
		.then((result) => {
			return result.entries.map((entry) => {
				return {
					size: entry.size,
					modified: entry.client_modified,
					name: entry.name,
					isDir: entry['.tag'] == 'folder',
					mime: Mime.lookup(entry.name)
				};
			});
		});
	}

	stat(session, path) {
		return callAPI(session, '/files/get_metadata', {
			path: makePathAbsolute(path)
		})
		.then((stat) => {
			return {
				size: stat.size,
				modified: stat.client_modified,
				name: stat.name,
				isDir: stat['.tag'] == 'folder',
				mime: Mime.lookup(stat.name)
			};
		});
	}

	mkdir(session, path) {
		return callAPI(session, '/files/create_folder', {
			path: makePathAbsolute(path)
		});
	}

	writeFile(session, path, data) {
		// TODO Use upload session for files bigger than 150Mo
		// (https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-start)
		// TODO Handle file conflict and write mode
		return callAPI(session, '/files/upload', data, 'content', false, {
			'Content-Type': 'application/octet-stream',
			'Dropbox-API-Arg': JSON.stringify({
				path: makePathAbsolute(path)
			})
		});
	}

	createWriteStream(session, path) {

		return request({
			url: 'https://content.dropboxapi.com/2/files/upload',
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + session.token,
				'Content-Type': 'application/octet-stream',
				'User-Agent': 'Unifile',
				'Dropbox-API-Arg': JSON.stringify({
					path: makePathAbsolute(path)
				})
			}
		});
	}

	readFile(session, path) {
		return callAPI(session, '/files/download', {}, 'content', false, {
			'Dropbox-API-Arg': JSON.stringify({
				path: makePathAbsolute(path)
			})
		});
	}

	createReadStream(session, path) {

		return request({
			url: 'https://content.dropboxapi.com/2/files/download',
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + session.token,
				'User-Agent': 'Unifile',
				'Dropbox-API-Arg': JSON.stringify({
					path: makePathAbsolute(path)
				})
			}
		});
	}

	rename(session, src, dest) {
		return callAPI(session, '/files/move', {
			from_path: makePathAbsolute(src),
			to_path: makePathAbsolute(dest)
		});
	}

	unlink(session, path) {
		return callAPI(session, '/files/delete', {
			path: makePathAbsolute(path)
		});
	}

	rmdir(session, path) {
		return this.unlink(session, path);
	}

	batch(session, actions, message) {
		let actionsChain = Promise.resolve();

		let uploadEntries = [];
		let deleteEntries = [];
		let moveEntries = [];

		const batchMap = {
			writefile: uploadBatch,
			rmdir: deleteBatch,
			rename: moveBatch
		};

		function closeBatchs(action) {
			for(const key in batchMap) {
				if(key !== action) {
					batchMap[key]();
				}
			}
		}

		function moveBatch() {
			if(moveEntries.length === 0) return Promise.resolve();

			const toMove = moveEntries.slice();
			actionsChain = actionsChain.then(() => {
				return callAPI(session, '/files/move_batch', {
					entries: toMove
				})
				.then((result) => checkBatchEnd(session, result, '/files/move_batch/check'));
			});
			moveEntries = [];
		}

		function deleteBatch() {
			if(deleteEntries.length === 0) return Promise.resolve();

			const toDelete = deleteEntries.slice();
			actionsChain = actionsChain.then(() => {
				return callAPI(session, '/files/delete_batch', {
					entries: toDelete
				})
				.then((result) => checkBatchEnd(session, result, '/files/delete_batch/check'));
			});
			deleteEntries = [];
		}

		function uploadBatch() {
			if(uploadEntries.length === 0) return Promise.resolve();

			const toUpload = uploadEntries.slice();
			actionsChain = actionsChain.then(() => {
				return Promise.map(toUpload, (action) => {
					return openUploadSession(session, action.content, true)
					.then((result) => {
						return {
							cursor: {
								session_id: result.session_id,
								offset: action.content.length
							},
							commit: {
								path: makePathAbsolute(action.path),
								mode: {'.tag': 'add'}
							}
						};
					});
				})
				.then((commits) => closeUploadBatchSession(session, commits))
				.then((result) => checkBatchEnd(session, result, '/files/upload_session/finish_batch/check'));
			});
			uploadEntries = [];
		}

		for(const action of actions) {
			switch (action.name.toLowerCase()) {
				case 'unlink':
				case 'rmdir':
					closeBatchs('rmdir');
					deleteEntries.push({
						path: makePathAbsolute(action.path)
					});
					break;
				case 'rename':
					closeBatchs(action.name.toLowerCase());
					if(!action.destination)
						return Promise.reject('Rename action must have a `destination` field');
					moveEntries.push({
						from_path: makePathAbsolute(action.path),
						to_path: makePathAbsolute(action.destination)
					});
					break;
				case 'writefile':
					closeBatchs(action.name.toLowerCase());
					uploadEntries.push(action);
					break;
				case 'mkdir':
					closeBatchs(action.name.toLowerCase());
					actionsChain = actionsChain.then(() => {
						this.mkdir(session, action.path);
					});
					break;
				default:
					console.warn(`Unsupported batch action: ${action.name}`);
			}
		}
		closeBatchs('');

		return actionsChain;
	}
}

module.exports = DropboxConnector;
