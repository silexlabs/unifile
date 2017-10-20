'use strict';

const Path = require('path');
const Url = require('url');
const {Writable, Transform, PassThrough} = require('stream');

const request = require('request');
const Promise = require('bluebird');
const Mime = require('mime');

const Tools = require('unifile-common-tools');

const NAME = 'github';
const SERVICE_HOST = 'github.com';
const APP_PERMISSION = 'scope=repo,delete_repo,user';

const {UnifileError, BatchError} = require('./error.js');

/*
 * Remove first '/', split the path and remove empty tokens
 * @param {String} path - Path to split
 * @return {Array<String>} an array with path levels as elements
 * @private
 */
function getPathTokens(path) {
	const cleanPath = path.startsWith('/') ? path.substr(1) : path;
	return cleanPath.split('/').filter((s) => s !== '');
}

/**
 * Handle GitHub pagination
 * @param  {Object} reqOptions - Options to pass to the request. Url will be overidden
 * @param  {string} link - Link header
 * @param  {Object[]} memo - Aggregator of result
 * @return {Promise} a Promise of aggregated result
 * @private
 */
function paginate(reqOptions, link, memo) {
	const links = link.split(/,\s*/);
	let matches;
	links.some(function(link) {
		matches = link.trim().match(/<(.+)>;\s*rel="next"/);
		return matches !== null;
	});
	// End of pagination
	if(!matches) {
		return Promise.resolve(memo);
	}
	return new Promise(function(resolve, reject) {
		reqOptions.url = matches[1];
		request(reqOptions, function(err, res, body) {
			paginate(reqOptions, res.headers.link, memo.concat(JSON.parse(body))).then(resolve);
		});
	});
}


/**
 * Move a folder or a file in a branch by transforming the given tree
 * @param  {string} src - Source path relative to branch root
 * @param  {string} dest - Destination path relative to branch root
 * @param  {Object} treeRes[].tree - Commit tree
 * @param  {string} [branch=master] - Branch containing file/folder
 * @private
 */
function move(src, dest, treeRes) {
	return treeRes.tree.map(function(file) {
		const regex = new RegExp('^' + src + '$|^' + src + '(/)');
		// Overrides file path
		return Object.assign({}, file, {path: file.path.replace(regex, dest + '$1')});
	});
}

/**
 * Remove a file/folder by transforming the given tree
 * @param  {string} path - Path to the file/folder to delete
 * @param  {Object} treeRes - Result of a GET request to the tree API
 * @param  {Object} treeRes[].tree - Commit tree
 * @param  {string} [branch=master] - Branch containing file/folder
 * @private
 */
function removeFile(path, treeRes) {
	const regex = new RegExp('^' + path + '$|^' + path + '(/)');
	const filteredTree = treeRes.tree.filter(function(file) {
		return !regex.test(file.path);
	});
	if(filteredTree.length === treeRes.tree.length)
		throw new UnifileError(UnifileError.ENOENT, 'Not Found');
	else return filteredTree;
}

const createBranch = Symbol('createBranch');
const commit = Symbol('commit');
const transformTree = Symbol('transformTree');
const createBlob = Symbol('createBlob');
const assignSessionAccount = Symbol('assignSessionAccount');
const commitBlob = Symbol('commitBlob');
const callAPI = Symbol('callAPI');

/**
 * Service connector for {@link https://github.com|GitHub} plateform.
 *
 * This will need a registered GitHub application with valid redirection for your server.
 * You can register a new application {@link https://github.com/settings/applications/new|here} and
 * learn more about GitHub OAuth Web application flow
 * {@link https://developer.github.com/v3/oauth/#web-application-flow|here}
 */
class GitHubConnector {
	/**
	 * @constructor
	 * @param {Object} config - Configuration object
	 * @param {string} config.clientId - GitHub application client ID
	 * @param {string} config.clientSecret - GitHub application client secret
	 * @param {string} [config.redirectUri] - GitHub application redirect URI.
	 *																				You still need to register it in your GitHub App
	 * @param {string} [config.name=github] - Name of the connector
	 * @param {string} [config.serviceHost=github.com] - Hostname of the service
	 * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
	 */
	constructor(config) {
		if(!config || !config.clientId || !config.clientSecret)
			throw new Error('Invalid configuration. Please refer to the documentation to get the required fields.');
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.serviceHost = config.serviceHost || SERVICE_HOST;
		this.oauthCallbackUrl = `https://${this.serviceHost}/login/oauth`;
		this.redirectUri = config.redirectUri || null;

		this.infos = Tools.mergeInfos(config.infos, {
			name: NAME,
			displayName: 'GitHub',
			icon: '../assets/github.png',
			description: 'Edit files from your GitHub repository.'
		});

		this.name = this.infos.name;
	}

	getInfos(session) {
		return Object.assign({
			isLoggedIn: !!(session && ('token' in session) || ('basic' in session)),
			isOAuth: true,
			username: (session && session.account) ? session.account.display_name : undefined
		}, this.infos);
	}

	login(session, loginInfos) {
		// Authenticated URL
		if(loginInfos.constructor === String) {
			const url = Url.parse(loginInfos);
			if(!url.auth)
				return Promise.reject(new UnifileError(
					UnifileError.EACCES,
					'Invalid URL. You must provide authentication: http://user:pwd@host'));
			this.serviceHost = url.host || this.serviceHost;
			return this.setAccessToken(session, `Basic ${new Buffer(url.auth).toString('base64')}`);

			// Basic auth
		} else if('user' in loginInfos && 'password' in loginInfos) {
			const auth = new Buffer(loginInfos.user + ':' + loginInfos.password).toString('base64');
			return this.setAccessToken(session, `Basic ${auth}`);

			// OAuth
		} else if('state' in loginInfos && 'code' in loginInfos) {
			if(loginInfos.state !== session.state)
				return Promise.reject(new UnifileError(UnifileError.EACCES, 'Invalid request (cross-site request)'));

			return new Promise((resolve, reject) => {
				request({
					url: this.oauthCallbackUrl + '/access_token',
					method: 'POST',
					body: {
						client_id: this.clientId,
						client_secret: this.clientSecret,
						code: loginInfos.code,
						state: session.state
					},
					json: true
				}, function(err, response, body) {
					if(err) reject(new UnifileError(UnifileError.EINVAL, 'Error while calling GitHub API. ' + err));
					else if(response.statusCode >= 400 || 'error' in body)
						reject(new UnifileError(UnifileError.EACCES, 'Unable to get access token. Please check your credentials.'));
					else resolve(body.access_token);
				});
			})
			.then((token) => {
				return this.setAccessToken(session, `token ${token}`);
			});
		} else {
			return Promise.reject(new UnifileError(UnifileError.EACCES, 'Invalid credentials'));
		}
	}

	setAccessToken(session, token) {
		// Check if token is a valid OAuth or Basic token
		if(!token.startsWith('token ') && !token.startsWith('Basic '))
			return Promise.reject(new UnifileError(
				UnifileError.EACCES,
				'Invalid token. It must start with either "token" or "Basic".'));
		// Create a copy to only set the true token when we know it's the good one
		const sessionCopy = Object.assign({}, session);
		sessionCopy.token = token;
		return this[callAPI](sessionCopy, '/user', null, 'GET')
		.then(this[assignSessionAccount].bind(undefined, session))
		.then(() => {
			session.token = sessionCopy.token;
			return session.token;
		});
	}

	clearAccessToken(session) {
		Tools.clearSession(session);
		return Promise.resolve(session);
	}

	getAuthorizeURL(session) {
		// Generate a random string for the state
		session.state = (+new Date() * Math.random()).toString(36).replace('.', '');
		return Promise.resolve(this.oauthCallbackUrl
			+ '/authorize?' + APP_PERMISSION
			+ '&client_id=' + this.clientId
			+ '&state=' + session.state
			+ (this.redirectUri ? '&redirect_uri=' + this.redirectUri : ''));
	}

	//Filesystem commands

	readdir(session, path) {
		const splitPath = getPathTokens(path);
		let resultPromise;
		let apiPath;
		switch (splitPath.length) {
			case 0: // List repos
				resultPromise = this[callAPI](session, '/user/repos', {affiliation: 'owner'}, 'GET')
				.then(function(res) {
					return res.map(function(item) {
						return {
							size: item.size,
							modified: item.updated_at,
							name: item.name,
							isDir: true,
							mime: 'application/git-repo'
						};
					});
				});
				break;
			case 1: // List all branches
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/branches';
				resultPromise = this[callAPI](session, apiPath, null, 'GET')
				.map((item) => {
					return this[callAPI](session, Url.parse(item.commit.url).path, null, 'GET')
					.then(function(result) {
						return result.commit.author.date;
					})
					.then(function(date) {
						return {
							size: 'N/A',
							modified: date,
							name: item.name,
							isDir: true,
							mime: 'application/git-branch'
						};
					});
				});
				break;
			default: // List files of one branch
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
				const filePath = splitPath.slice(2).join('/');
				const reqData = {
					ref: splitPath[1]
				};
				resultPromise = this[callAPI](session, apiPath + '/contents/' + filePath, reqData, 'GET')
				.map((item) => {
					return this[callAPI](session, apiPath + '/commits', {path: item.path, sha: splitPath[1]}, 'GET')
					.then(function(commits) {
						const isDir = item.type === 'dir';
						return {
							size: item.size,
							modified: commits[0].commit.author.date,
							name: item.name,
							isDir: isDir,
							mime: isDir ? 'application/directory' : Mime.lookup(item.name)
						};
					});
				});
		}

		return resultPromise;
	}

	stat(session, path) {
		const splitPath = getPathTokens(path);
		let resultPromise;
		let apiPath;
		switch (splitPath.length) {
			case 0: resultPromise = Promise.reject(new UnifileError(UnifileError.EINVAL, 'You must provide a path to stat'));
				break;
			case 1: // Get repo stat
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
				resultPromise = this[callAPI](session, apiPath, null, 'GET')
				.then(function(repo) {
					return {
						size: repo.size,
						modified: repo.updated_at,
						name: repo.name,
						isDir: true,
						mime: 'application/git-repo'
					};
				});
				break;
			case 2: // Get branch stat
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/branches/' + splitPath[1];
				resultPromise = this[callAPI](session, apiPath, null, 'GET')
				.then(function(branch) {
					return {
						size: 'N/A',
						modified: branch.commit.commit.author.date,
						name: branch.name,
						isDir: true,
						mime: 'application/git-branch'
					};
				});
				break;
			default: // Get a content stat
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
				const filePath = splitPath.slice(2).join('/');
				const reqData = {
					ref: splitPath[1]
				};
				resultPromise = this[callAPI](session, apiPath + '/contents/' + filePath, reqData, 'GET')
				.then((stat) => {
					if(Array.isArray(stat)) {
						return {
							size: 'N/A',
							modified: 'N/A',
							name: filePath.split('/').pop(),
							isDir: true,
							mime: 'application/directory'
						};
					} else {
						return this[callAPI](session, apiPath + '/commits', {path: stat.path, sha: splitPath[1]}, 'GET')
						.then(function(commit) {
							return {
								size: stat.size,
								modified: commit[0].commit.author.date,
								name: stat.name,
								isDir: false,
								mime: Mime.lookup(stat.name)
							};
						});
					}
				});
		}

		return resultPromise;
	}

	mkdir(session, path) {
		const splitPath = getPathTokens(path);
		let reqData = null;
		let apiPath;
		switch (splitPath.length) {
			case 0: // Error
				return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot create dir with an empty name.'));
			case 1: // Create a repo
				apiPath = '/user/repos';
				reqData = {
					name: splitPath[0],
					auto_init: true
				};
				return this[callAPI](session, apiPath, reqData, 'POST')
				// Renames default README to a more discreet .gitkeep
				.then(() => this.rename(session, Path.join(path, 'master/README.md'), Path.join(path, 'master/.gitkeep')));
			case 2: // Create a branch
				return this[createBranch](session, splitPath[0], splitPath[1]);
			default: // Create a folder (with a .gitkeep file in it because git doesn't track empty folder)
				const filePath = splitPath.slice(2).join('/');

				apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/contents/' + filePath;
				reqData = {
					message: 'Create ' + filePath,
					content: new Buffer('').toString('base64'),
					branch: splitPath[1]
				};
				return this[callAPI](session, apiPath + '/.gitkeep', reqData, 'PUT')
				.catch((err) => {
					if(err.message.startsWith('Invalid request')) throw new Error('Reference already exists');
					else throw err;
				});
		}
	}

	writeFile(session, path, data) {
		const splitPath = getPathTokens(path);
		if(splitPath.length < 3) {
			return Promise.reject(new UnifileError(UnifileError.ENOTSUP, 'This folder can only contain folders.'));
		}
		return this[createBlob](session, splitPath[0], data)
		.then((blob) => this[commitBlob](session, splitPath, blob));
	}

	createWriteStream(session, path) {
		const splitPath = getPathTokens(path);
		if(splitPath.length < 3) {
			const stream = new PassThrough();
			process.nextTick(() => {
				stream.emit('error', new UnifileError(UnifileError.ENOTSUP, 'This folder can only contain folders.'));
			});
			return stream;
		}

		const apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/git/blobs';
		// This will encapsulate the raw content into an acceptable Blob request
		const transformer = new Transform({
			transform(chunk, encoding, callback) {
				if(this.first) {
					this.push('{"encoding": "base64", "content": "');
					this.first = false;
				}
				callback(null, chunk.toString('base64'));
			},
			flush(callback) {
				this.push('"}');
				callback(null);
			}
		});
		transformer.first = true;

		// Make the request and pipe the transformer as input
		const stream = this[callAPI](session, apiPath, {}, 'POST', true);
		transformer.pipe(stream);

		// Catch Blob request response
		const chunks = [];
		const aggregator = new Writable({
			write(chunk, encoding, callback) {
				chunks.push(chunk);
				callback(null);
			}
		});
		stream.pipe(aggregator);

		// Now commit the blob with the full response
		aggregator.on('finish', () => {
			this[commitBlob](session, splitPath, JSON.parse(Buffer.concat(chunks).toString()))
			.then(() => {
				transformer.emit('close');
			});
		});

		return transformer;
	}

	readFile(session, path, isStream = false) {
		const splitPath = getPathTokens(path);
		if(!isStream && splitPath.length < 3) {
			return Promise.reject(new UnifileError(UnifileError.ENOTSUP, 'This folder only contain folders.'));
		}
		const apiPath = '/repos/' + session.account.login
			+ '/' + splitPath[0] + '/contents/'
			+ splitPath.slice(2).join('/');

		var promise = this[callAPI](session, apiPath, {ref: splitPath[1]}, 'GET', isStream);
		if(isStream) return promise;
		else {
			return promise.then(function(res) {
				if(res.type === 'file') {
					return Buffer.from(res.content, res.encoding);
				} else {
					return Promise.reject(new UnifileError(UnifileError.EISDIR, 'This is a folder.'));
				}
			});
		}
	}

	createReadStream(session, path) {
		function extract(data, idx, token) {
			return data.substr(idx + token.length).split('"')[0];
		}

		const transformer = new Transform({
			transform(chunk, encoding, callback) {
				const data = chunk.toString();
				if(this.isContent) {
					// return all the content until a " shows up
					callback(null, data.split('"')[0]);
				} else {
					// TODO better start detection
					let idx;
					if((idx = data.indexOf(this.contentToken)) > -1) {
						this.isContent = true;
						// Content detected, returns it until "
						callback(null, Buffer.from(extract(data, idx, this.contentToken), 'base64').toString());
					} else if((idx = data.indexOf(this.errorToken)) > -1) {
						// Request errored
						this.emit('error', new Error(extract(data, idx, this.errorToken)));
					} else {
						// Drop content
						callback(null);
					}
				}
			}
		});
		transformer.isContent = false;
		transformer.contentToken = 'content":"';
		transformer.errorToken = 'message":"';
		return this.readFile(session, path, true)
		.pipe(transformer);
	}

	rename(session, src, dest) {
		const splitPath = getPathTokens(src);
		if(!dest) return Promise.reject(new Error('Cannot rename path with an empty destination'));
		const splitPathDest = getPathTokens(dest);
		let apiPath;
		switch (splitPath.length) {
			case 0: // Error
				return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot rename path with an empty name.'));
			case 1: // Rename repo
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
				const reqData = {name: dest};
				return this[callAPI](session, apiPath, reqData, 'PATCH');
			case 2: // Rename branch (actually copy src to dest then remove src)
				apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/git/refs/heads/';
				return this[createBranch](session, splitPath[0], splitPathDest[1], splitPath[1])
				.then(() => {
					return this[callAPI](session, apiPath + splitPath[1], null, 'DELETE');
				});
			default: // Rename a file/folder
				const fileSrc = splitPath.slice(2).join('/');
				const fileDest = splitPathDest.slice(2).join('/');
				return this[transformTree](session, splitPath[0], move.bind(undefined, fileSrc, fileDest),
					'Move ' + fileSrc + ' to ' + fileDest, splitPath[1]);
		}
	}

	unlink(session, path) {
		if(!path) return Promise.reject(new UnifileError(UnifileError.EINVAL, 'Cannot remove path with an empty name.'));
		const splitPath = getPathTokens(path);
		if(splitPath.length < 3)
			return Promise.reject(new UnifileError(UnifileError.EISDIR, 'Path is a folder. Use rmdir()'));

		const filePath = splitPath.slice(2).join('/');
		return this[transformTree](session, splitPath[0], removeFile.bind(undefined, filePath),
			'Remove ' + filePath, splitPath[1]);
	}

	rmdir(session, path) {
		const splitPath = getPathTokens(path);
		const repoPath = '/repos/' + session.account.login + '/' + splitPath[0];
		switch (splitPath.length) {
			case 0: // Error
				return Promise.reject(new UnifileError(UnifileError.INVAL, 'Cannot remove path with an empty name.'));
			case 1: // Remove repo
				return this[callAPI](session, repoPath, null, 'DELETE');
			case 2: // Remove branch
				return this[callAPI](session, repoPath + '/branches', null, 'GET')
				.then((branches) => {
					if(branches.length > 1)
						return this[callAPI](session, repoPath + '/git/refs/heads/' + splitPath[1], null, 'DELETE');
					else {
						const err = new Error('You cannot leave this folder empty.');
						err.statusCode = 400;
						throw err;
					}
				});
			default: // Remove file/folder
				const path = splitPath.slice(2).join('/');
				return this[transformTree](session, splitPath[0], removeFile.bind(undefined, path),
					'Remove ' + path, splitPath[1]);
		}
	}

	batch(session, actions, message) {
		let actionsChain = Promise.resolve();
		// Filter invalid batch actions
		const actionQueue = actions.slice()
		.filter((action) => ['rmdir', 'unlink', 'mkdir', 'writefile', 'rename'].indexOf(action.name.toLowerCase()) > -1);
		while(actionQueue.length > 0) {
			const action = actionQueue.shift();
			const splitPath = getPathTokens(action.path);
			switch (splitPath.length) {
				case 0: return Promise.reject(new BatchError(
					UnifileError.EINVAL,
					'Cannot execute batch action without a path'));
				case 1:
				case 2:
					const actionName = action.name.toLowerCase();
					switch (actionName) {
						case 'rmdir':
						case 'mkdir':
							actionsChain = actionsChain.then(() => this[actionName](session, action.path))
							.catch((err) => err.name !== 'BatchError',
								(err) => {throw new Error(`Could not complete action ${actionName}: ${err.message}`);});
							break;
						case 'writefile':
							return Promise.reject(new UnifileError(
								UnifileError.ENOTSUP,
								`Could not complete action ${actionName}: Cannot create file here.`));
						case 'rename':
							if(!action.destination)
								return new Promise.reject(new BatchError(
									UnifileError.EINVAL,
									'Rename actions should have a destination'));
							actionsChain = actionsChain.then(() => this.rename(session, action.path, action.destination))
							.catch((err) => err.name !== 'BatchError',
								(err) => {
									throw new BatchError(
										UnifileError.EINVAL,
										`Could not complete action ${actionName}: ${err.message}`);
								});
							break;
						default:
							console.warn(`Unsupported batch action on repo/branch: ${actionName}`);
					}
					break;
				default:
					const fileActions = [action];
					// Get all the file action on this branch to group in a commit
					let sameBranch = true;
					while(actionQueue.length > 0 && sameBranch) {
						const nextSplitPath = getPathTokens(actionQueue[0].path);
						const [lastRepo, lastBranch] = getPathTokens(action.path);
						sameBranch = nextSplitPath.length > 2 && lastRepo === nextSplitPath[0] && lastBranch === nextSplitPath[1];
						if(sameBranch) fileActions.push(actionQueue.shift());
					}

					actionsChain = actionsChain.then(() => this[transformTree](session, splitPath[0], function(treeRes) {
						for(const currentAction of fileActions) {
							const path = getPathTokens(currentAction.path).slice(2).join('/');
							switch (currentAction.name.toLowerCase()) {
								case 'unlink':
								case 'rmdir':
									treeRes.tree = removeFile(path, treeRes);
									break;
								case 'rename':
									if(!currentAction.destination)
										return new Promise.reject(new UnifileError(
											UnifileError.EINVAL,
											'Rename actions should have a destination'));
									const src = path;
									const dest = getPathTokens(currentAction.destination).slice(2).join('/');
									treeRes.tree = move(src, dest, treeRes);
									break;
								case 'mkdir':
									treeRes.tree.push({
										path: path + '/.gitkeep',
										mode: '100644',
										type: 'blob',
										content: ''
									});
									break;
								case 'writefile':
									if(!currentAction.content)
										return new Promise.reject(new UnifileError(
											UnifileError.EINVAL,
											'WriteFile actions should have a content'));
									treeRes.tree.push({
										path: path,
										content: currentAction.content,
										mode: '100644',
										type: 'blob'
									});
									break;
								default:
									console.warn(`Unsupported batch action: ${currentAction.name}`);
							}
						}
						return treeRes.tree;
					}, message || 'Batch update', splitPath[1]))
					.catch((err) => err.name !== 'BatchError', (err) => {
						throw new BatchError(UnifileError.EIO, `Could not modify tree: ${err.message}`);
					});
			}
		}
		return actionsChain;
	}

	// Internals

	/**
	 * Create a branch with the given parameters
	 * @param {GHSession} session - GH session
	 * @param  {string} repo - Repository name where to create the branch
	 * @param  {string} branchName - Name for the newly created branch
	 * @param  {string} [fromBranch] - Branch to start the new branch from. Default to the default_branch of the repo
	 * @return {Promise} a Promise of the API call result
	 * @private
	 */
	[createBranch](session, repo, branchName, fromBranch) {
		const apiPath = '/repos/' + session.account.login + '/' + repo + '/git/refs';
		return this[callAPI](session, apiPath + '/heads', null, 'GET')
		.then((res) => {
			const reqData = {
				ref: 'refs/heads/' + branchName
			};
			if(!fromBranch) reqData.sha = res[0].object.sha;
			else {
				const origin = res.filter(function(branch) {
					return branch.ref === 'refs/heads/' + fromBranch;
				})[0];
				if(!origin) throw new Error('Unknown branch origin ' + fromBranch);
				reqData.sha = origin.object.sha;
			}
			return this[callAPI](session, apiPath, reqData, 'POST');
		});
	}

	/**
	 * Create and push a commit
	 * @param {GHSession} session - GH session
	 * @param {string} repo - Name of the repository to commit
	 * @param {Object[]} tree - Array of objects to commit
	 * @param {string} tree[].path - Full path to the file to modify
	 * @param {string} tree[].mode - Object mode (100644 for files)
	 * @param {string} tree[].type - Object type (blob/commit/tree)
	 * @param {string} [tree[].content] - Content to put into file. If set, sha will be ignored
	 * @param {string} [tree[].sha] - Sha of the object to put in the tree. Will be ignored if content is set
	 * @param {string} message - Message of the commit
	 * @param  {string} [branch=master] - Branch containing the tree
	 * @return {Promise} a Promise of the server response
	 *
	 * @see {@link https://developer.github.com/v3/git/trees/#create-a-tree|Create a tree}
	 * @private
	 * */
	[commit](session, repo, tree, message, branch) {
		const apiPath = '/repos/' + session.account.login + '/' + repo + '/git';
		let lastCommitSha;

		// Get branch head
		return this[callAPI](session, apiPath + '/refs/heads/' + branch, null, 'GET')
		.then((res) => {
			lastCommitSha = res.object.sha;
			// Get last commit info
			return this[callAPI](session, apiPath + '/commits/' + lastCommitSha, null, 'GET');
		})
		.then((res) => {
			const data = {
				base_tree: res.tree.sha,
				tree: tree
			};
				// Create a new tree
			return this[callAPI](session, apiPath + '/trees', data, 'POST');
		})
		.then((res) => {
			const data = {
				parents: [lastCommitSha],
				tree: res.sha,
				message: message
			};
				// Create a new commit with the new tree
			return this[callAPI](session, apiPath + '/commits', data, 'POST');
		})
		.then((res) => {
			const data = {
				sha: res.sha
			};
				// Update head
			return this[callAPI](session, apiPath + '/refs/heads/' + branch, data, 'PATCH');
		});
	}


	/**
	 * Transform the git tree and commit the transformed tree
	 * @param {GHSession} session - GH session
	 * @param {string} repo - Name of the repository to commit
	 * @param  {Function} transformer - Function to apply on tree. Get the tree as only param and return an array.
	 * @param  {string} message - Commit message for the new tree
	 * @param  {string} [branch=master] - Branch containing the tree
	 * @return {Promise} a Promise of the server response
	 *
	 * @see {@link https://developer.github.com/v3/git/trees/#create-a-tree|Create a tree}
	 * @private
	 */
	[transformTree](session, repo, transformer, message, branch = 'master') {
		let lastCommitSha;
		const apiPath = '/repos/' + session.account.login + '/' + repo;
		return this[callAPI](session, apiPath + '/git/refs/heads/' + branch, null, 'GET')
		.then((head) => {
			lastCommitSha = head.object.sha;
			return this[callAPI](session, apiPath + '/git/trees/' + head.object.sha, {recursive: 1}, 'GET');
		})
		.then((res) => {
			return transformer(res);
		})
		.then((tree) => {
			if(Array.isArray(tree) && tree.length > 0) {
				return this[callAPI](session, apiPath + '/git/trees', {tree: tree}, 'POST');
			} else if(Array.isArray(tree)) {
				return Promise.reject(new UnifileError(UnifileError.ENOTSUP, 'You can not leave this folder empty.'));
			} else {
				return Promise.reject(new UnifileError(
					UnifileError.EIO,
					'Invalid tree transformation. Transformer must return an array.'));
			}
		})
		.then((newTree) => {
			const data = {
				parents: [lastCommitSha],
				tree: newTree.sha,
				message: message
			};
			return this[callAPI](session, apiPath + '/git/commits', data, 'POST');
		})
		.then((res) => {
			const data = {
				sha: res.sha
			};
			return this[callAPI](session, apiPath + '/git/refs/heads/' + branch, data, 'PATCH');
		});
	}

	/**
	 * Create a blob in the designated repository
	 * @param {Object} session - GitHub session storage
	 * @param {string} repoName - Name of the repository where to create the blob
	 * @param {string|Buffer} content - Content of the blob
	 * @return {Promise} a promise of result for the blob creation
	 *
	 * @see {@link https://developer.github.com/v3/git/blobs/#create-a-blob|Create a blob}
	 * @private
	 */
	[createBlob](session, repoName, content) {
		const buffer = Buffer.isBuffer(content) ? content : new Buffer(content);
		const apiPath = '/repos/' + session.account.login + '/' + repoName + '/git/blobs';
		return this[callAPI](session, apiPath, {
			content: buffer.toString('base64'),
			encoding: 'base64'
		}, 'POST');
	}

	/**
	 * Fetch the account information on the service and map them to the session
	 * @param {Object} session - GH session
	 * @param {Object} account - GH account
	 * @return {Promise<null>} an empty promise
	 * @private
	 */
	[assignSessionAccount](session, account) {
		session.account = {
			display_name: account.name,
			login: account.login,
			num_repos: account.public_repos
		};
	}

	/**
	 * Commit a blob to the given repo, branch and path
	 * @param {Object} session - GH session
	 * @param {string[]} splitPath - Path tokens containing repo/branch/path
	 * @param {Object} blob - Blob return by the blob creation route
	 * @private
	 */
	[commitBlob](session, splitPath, blob) {
		const path = splitPath.slice(2).join('/');
		return this[commit](session, splitPath[0], [{
			path: path,
			sha: blob.sha,
			mode: '100644',
			type: 'blob'
		}], 'Create ' + path, splitPath[1]);
	}

	/**
	 * Make a call to the GitHub API
	 * @param {Object} session - GitHub session storage
	 * @param {string} path - End point path
	 * @param {Object} data - Data to pass. Convert to querystring if method is GET or to the request body
	 * @param {string} method - HTTP verb to use
	 * @param {boolean} isStream - Access the API as a stream or not
	 * @param {boolean} retry - Allow the request to retry on error
	 * @return {Promise|Stream} a Promise of the result send by server or a stream to the endpoint
	 * @private
	 */
	[callAPI](session, path, data, method, isStream = false, retry = true) {
		const reqOptions = {
			url: `https://api.${this.serviceHost}${path}`,
			method: method,
			headers: {
				'Accept': 'application/vnd.github.v3+json',
				'Authorization': session.token,
				'User-Agent': 'Unifile'
			}
		};

		if(method === 'GET') reqOptions.qs = data;
		else if(!isStream) reqOptions.body = JSON.stringify(data);

		if(isStream) return request(reqOptions);
		else {
			return new Promise((resolve, reject) => {
				request(reqOptions, (err, res, body) => {
					if(err) {
						return reject(err);
					}
					if(res.statusCode === 409 && JSON.parse(body).message.toLowerCase() === 'git repository is empty.' && retry) {
						return this[callAPI](session, path, data, method, false, false)
						.then(resolve)
						.catch(reject);
					} else if(res.statusCode >= 400) {
						console.log('request failed', method, path, data, res.statusCode, body);
						const code = (() => {
							switch (res.statusCode) {
								case 403: return UnifileError.EACCES;
								case 404: return UnifileError.ENOENT;
								default: return UnifileError.EIO;
							}
						})();
						const error = new UnifileError(code, JSON.parse(body).message);
						return reject(error);
					}
					try {
						const result = res.statusCode !== 204 ? JSON.parse(body) : null;
						if(res.headers.hasOwnProperty('link')) {
							paginate(reqOptions, res.headers.link, result).then(resolve);
						} else resolve(result);
					} catch (e) {
						reject(e);
					}
				});
			});
		}
	}
}

module.exports = GitHubConnector;
