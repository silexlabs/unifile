'use strict';

const {PassThrough} = require('stream');
const Promise = require('bluebird');
const request = require('request');
const Mime = require('mime');

const Tools = require('unifile-common-tools');
const {UnifileError, BatchError} = require('./error');

const NAME = 'dropbox';
const DB_OAUTH_URL = 'https://www.dropbox.com/oauth2';

const charsToEncode = /[\u007f-\uffff]/g;

/**
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
function callAPI(session, path, data, subdomain = 'api', isJson = true, headers = null) {
	const authorization = 'Bearer ' + session.token;

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

	if(data && Object.keys(data).length !== 0) reqOptions.body = data;

	if(headers) {
		for(const header in headers) {
			reqOptions.headers[header] = headers[header];
		}
	}

	return new Promise(function(resolve, reject) {
		request(reqOptions, function(err, res, body) {
			if(err) {
				reject(err);
			} else if(res.statusCode >= 400) {
				let errorMessage = null;
				// In case of users/get_current_account, Dropbox return a String with the error
				// Since isJson = true, it gets parsed by request
				if(Buffer.isBuffer(body)) {
					try {
						errorMessage = JSON.parse(body.toString()).error_summary;
					} catch (e) {
						errorMessage = body.toString();
					}
				} else {
					errorMessage = (isJson ? body : JSON.parse(body)).error_summary;
				}
				// Dropbox only uses 409 for endpoints specific errors
				let filename = null;
				try {
					filename = res.request.headers.hasOwnProperty('Dropbox-API-Arg') ?
						JSON.parse(res.request.headers['Dropbox-API-Arg']).path
						: JSON.parse(res.request.body).path;
				} catch (e) {}
				if(errorMessage.includes('/not_found/')) {
					reject(new UnifileError(UnifileError.ENOENT, `Not Found: ${filename}`));
				} else if(errorMessage.startsWith('path/conflict/')) {
					reject(new UnifileError(UnifileError.EINVAL, `Creation failed due to conflict: ${filename}`));
				} else if(errorMessage.startsWith('path/not_file/')) {
					reject(new UnifileError(UnifileError.EINVAL, `Path is a directory: ${filename}`));
				} else if(res.statusCode === 401) {
					reject(new UnifileError(UnifileError.EACCES, errorMessage));
				} else {
					reject(new UnifileError(UnifileError.EIO, errorMessage));
				}
			} else resolve(body);
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
			newId = newId || jobId;
			return callAPI(session, checkRoute, {
				async_job_id: newId
			})
			.then((result) => checkBatchEnd(session, result, checkRoute, newId));
		case 'complete':
			const failed = result.entries.reduce((memo, entry, index) => {
				if(entry['.tag'] === 'failure') memo.push({entry, index});
				return memo;
			}, []);
			if(failed.length > 0) {
				const errors = failed.map(({entry, index}) => {
					const failureTag = entry.failure['.tag'];
					return `Could not complete action ${index}: ${failureTag + '/' + entry.failure[failureTag]['.tag']}`;
				});
				return Promise.reject(new UnifileError(
					UnifileError.EIO, errors.join(', ')));
			}
			return Promise.resolve();
	}
}

function makePathAbsolute(path) {
	return path === '' ? path : '/' + path.split('/').filter((token) => token != '').join('/');
}

function safeStringify(v) {
	return JSON.stringify(v).replace(charsToEncode,
		function(c) {
			return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
		}
	);
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
	 * @param {string} [config.writeMode=overwrite] - Write mode when files conflicts. Must be one of
	 * 	'add'/'overwrite'/'update'.
	 * {@link https://www.dropbox.com/developers/documentation/http/documentation#files-upload|see Dropbox manual}
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
			description: 'Edit files from your Dropbox.'
		});

		this.name = this.infos.name;
		if(!config.writeMode || ['add', 'overwrite', 'update'].every((mode) => mode !== config.writeMode))
			this.writeMode = 'overwrite';
		else this.writeMode = config.writeMode;
	}

	getInfos(session) {
		return Object.assign({
			isLoggedIn: (session && 'token' in session),
			isOAuth: true,
			username: session.account ? session.account.name.display_name : undefined
		}, this.infos);
	}

	setAccessToken(session, token) {
		session.token = token;
		const accountFields = [
			'account_id',
			'name',
			'email'
		];
		const filterAccountInfos = (account) => {
			return Object.keys(account).reduce((memo, key) => {
				if(accountFields.includes(key)) memo[key] = account[key];
				return memo;
			}, {});
		};
		let accountPromised = null;
		if(session.account && 'id' in session.account) {
			accountPromised = callAPI(session, '/users/get_account', {
				account_id: session.account.id
			});
		} else {
			accountPromised = callAPI(session, '/users/get_current_account');
		}
		return accountPromised.then((account) => {
			session.account = filterAccountInfos(account);
			return token;
		})
		.catch((err) => Promise.reject(new UnifileError(UnifileError.EACCES, 'Bad credentials')));
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

		if(typeof loginInfos === 'object' && 'state' in loginInfos && 'code' in loginInfos) {
			if(loginInfos.state !== session.state)
				return Promise.reject(new UnifileError(UnifileError.EACCES, 'Invalid request (cross-site request)'));
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
		} else {
			return Promise.reject(new UnifileError(UnifileError.EACCES, 'Invalid credentials'));
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
					mime: Mime.getType(entry.name)
				};
			});
		});
	}

	stat(session, path) {
		if(!path) return Promise.reject(new UnifileError(UnifileError.EINVAL, 'You must provide a path to stat'));

		return callAPI(session, '/files/get_metadata', {
			path: makePathAbsolute(path)
		})
		.then((stat) => {
			return {
				size: stat.size,
				modified: stat.client_modified,
				name: stat.name,
				isDir: stat['.tag'] == 'folder',
				mime: Mime.getType(stat.name)
			};
		});
	}

	mkdir(session, path) {
		if(!path) return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot create dir with an empty name.'));
		return callAPI(session, '/files/create_folder_v2', {
			path: makePathAbsolute(path)
		});
	}

	writeFile(session, path, data) {
		// TODO Use upload session for files bigger than 150Mo
		// (https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-start)
		// TODO Handle file conflict and write mode
		return callAPI(session, '/files/upload', data, 'content', false, {
			'Content-Type': 'application/octet-stream',
			'Dropbox-API-Arg': safeStringify({
				path: makePathAbsolute(path),
				mode: this.writeMode
			})
		});
	}

	createWriteStream(session, path) {

		const writeStream = request({
			url: 'https://content.dropboxapi.com/2/files/upload',
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + session.token,
				'Content-Type': 'application/octet-stream',
				'User-Agent': 'Unifile',
				'Dropbox-API-Arg': JSON.stringify({
					path: makePathAbsolute(path),
					mode: this.writeMode
				})
			}
		})
		.on('response', (response) => {
			if(response.statusCode === 409)
				writeStream.emit('error', new UnifileError(UnifileError.EIO, 'Creation failed'));
			else if(response.statusCode === 200) writeStream.emit('close');
		});

		return writeStream;
	}

	readFile(session, path) {
		return callAPI(session, '/files/download', {}, 'content', false, {
			'Dropbox-API-Arg': safeStringify({
				path: makePathAbsolute(path)
			})
		});
	}

	createReadStream(session, path) {
		const readStream = new PassThrough();
		const req = request({
			url: 'https://content.dropboxapi.com/2/files/download',
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + session.token,
				'User-Agent': 'Unifile',
				'Dropbox-API-Arg': safeStringify({
					path: makePathAbsolute(path)
				})
			}
		})
		.on('response', (response) => {
			if(response.statusCode === 200) req.pipe(readStream);

			switch (response.statusCode) {
				case 400: readStream.emit('error', new UnifileError(UnifileError.EINVAL, 'Invalid request'));
					break;
				case 409:
					const chunks = [];
					req.on('data', (data) => {
						chunks.push(data);
					});
					req.on('end', () => {
						const body = JSON.parse(Buffer.concat(chunks).toString());
						if(body.error_summary.startsWith('path/not_found'))
							readStream.emit('error', new UnifileError(UnifileError.ENOENT, 'Not Found'));
						else if(body.error_summary.startsWith('path/not_file'))
							readStream.emit('error', new UnifileError(UnifileError.EISDIR, 'Path is a directory'));
						else
							readStream.emit('error', new UnifileError(UnifileError.EIO, 'Unable to read file'));
					});
			}
		});
		return readStream;
	}

	rename(session, src, dest) {
		if(!src)
			return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot rename path with an empty name'));
		if(!dest)
			return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot rename path with an empty destination'));
		return callAPI(session, '/files/move', {
			from_path: makePathAbsolute(src),
			to_path: makePathAbsolute(dest)
		});
	}

	unlink(session, path) {
		if(!path)
			return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot remove path with an empty name'));
		return callAPI(session, '/files/delete_v2', {
			path: makePathAbsolute(path)
		});
	}

	rmdir(session, path) {
		return this.unlink(session, path);
	}

	batch(session, actions, message) {
		const writeMode = this.writeMode;
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

			/*
				Dropbox executes all the deletion at the same time,
				so we remove all the descendant of a deleted folder beforehand
			*/
			const toDelete = deleteEntries.slice().sort((a, b) => a.path.length - b.path.length);
			const deduplicated = [];
			while(toDelete.length !== 0) {
				if(!deduplicated.some(({path}) => toDelete[0].path.includes(path + '/'))) {
					deduplicated.push(toDelete.shift());
				} else toDelete.shift();
			}
			actionsChain = actionsChain.then(() => {
				return callAPI(session, '/files/delete_batch', {
					entries: deduplicated
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
					const bitContent = new Buffer(action.content);
					return openUploadSession(session, bitContent, true)
					.then((result) => {
						return {
							cursor: {
								session_id: result.session_id,
								offset: bitContent.length
							},
							commit: {
								path: makePathAbsolute(action.path),
								mode: writeMode
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
			if(!action.path)
				return Promise.reject(new BatchError(UnifileError.EINVAL,
					'Cannot execute batch action without a path'));
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
						return Promise.reject(new BatchError(
							UnifileError.EINVAL,
							'Rename actions should have a destination'));
					moveEntries.push({
						from_path: makePathAbsolute(action.path),
						to_path: makePathAbsolute(action.destination)
					});
					break;
				case 'writefile':
					closeBatchs(action.name.toLowerCase());
					if(!action.content)
						return Promise.reject(new BatchError(
							UnifileError.EINVAL,
							'Write actions should have a content'));
					uploadEntries.push(action);
					break;
				case 'mkdir':
					closeBatchs(action.name.toLowerCase());
					actionsChain = actionsChain.then(() => {
						return this.mkdir(session, action.path);
					})
					.catch((err) => err.name !== 'BatchError',
						(err) => {
							throw new BatchError(
								UnifileError.EINVAL,
								`Could not complete action ${action.name}: ${err.message}`);
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
