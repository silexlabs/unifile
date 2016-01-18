/**
 * Service connector for the GitHub api
 *
 * Uses:
 * https://developer.github.com/v3/
 *
 */

/**
 * GitHub session object
 * @typedef {Object} GHSession
 * @property {Object} session.gh_account - Account information
 * @property {string} session.gh_token - Access token *
 */

var pathModule = require('path');
var url = require('url');

var request = require('request');
var Promise = require('bluebird');
var mime = require('mime');

var utils = require('../core/utils.js');

function isConnected(req) {
	return 'gh_token' in req.session;
}

function getPathTokens(path) {
	// Remove first / and split the path and remove empty tokens
	// TODO Use arrow functiond and .filter() when ES2015
	return path.substr(1).split('/').reduce(function (memo, subpath) {
		if (subpath !== '') memo.push(subpath);
		return memo;
	}, []);
}

/**
 * Handle GitHub pagination
 * @param  {Object} reqOptions - Options to pass to the request. Url will be overidden
 * @param  {string} link - Link header
 * @param  {objegh[]} memo - Aggregator of result
 * @return {Promise} a Promise of aggregated result
 */
function paginate(reqOptions, link, memo) {
	var links = link.split(/,\s*/);
	var matches;
	links.some(function(link) {
		matches = link.trim().match(/<(.+)>;\s*rel="next"/);
		return matches !== null;
	});
	// End of pagination
	if(!matches){
		return Promise.resolve(memo);
	}
	return new Promise(function(resolve, reject) {
		reqOptions.url = matches[1];
		request(reqOptions, function(err, res, body) {
				memo = memo.concat(memo, JSON.parse(body));
				paginate(reqOptions, res.headers.link, memo).then(resolve);
		});
	});
}

/**
 * Make a call to the GitHub API
 * @param {string] token - Access token to the API
 * @param {string} path - End point path
 * @param {Object} data - Data to pass. Convert to querystring if method is GET
 * or to the request body
 * @param {string} method - HTTP verb to use
 * @return {Promise} a Promise of the result send by server
 */
function callAPI(token, path, data, method) {
	var reqOptions = {
		url: 'https://api.github.com' + path,
		method: method,
		headers: {
			'Accept': 'application/vnd.github.v3+json',
			'Authorization': 'token ' +  token,
			'User-Agent': 'Unifile'
		}
	};
	method === 'GET' ? reqOptions.qs = data : reqOptions.body = JSON.stringify(data);
  return new Promise(function(resolve, reject) {
		request(reqOptions, function (err, res, body) {
			if (err) {
				return reject(err);
			}
			if (res.statusCode >= 400) {
				var error = new Error(JSON.parse(body).message);
				error.statusCode = res.statusCode;
				return reject(error);
			}
		 	try {
				// var result = res.statusCode !== 204 ? body : '';
				var result = res.statusCode !== 204 ? JSON.parse(body) : null;
				if(res.headers.hasOwnProperty('link'))
					paginate(reqOptions, res.headers.link, result).then(resolve);
				else resolve(result);
			} catch (e) {
				reject(e);
			}
		});
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
 * @param {string} tree[].[content] - Content to put into file. If set, sha will be ignored
 * @param {string} tree[].[sha] - Sha of the object to put in the tree. Will be ignored if content is set
 * @param {string} message - Message of the commit
 * @param  {string} [branch=master] - Branch containing the tree
 * @return {Promise} a Promise of the server response
 *
 * @see https://developer.github.com/v3/git/trees/#create-a-tree
 */
function commit(session, repo, tree, message, branch) {
	var apiPath = '/repos/' + session.gh_account.login + '/' + repo + '/git';
	var token = session.gh_token;
	var lastCommitSha;

	return callAPI(token, apiPath + '/refs/heads/' + branch, null, 'GET')
	.then(function(res){
		lastCommitSha = res.object.sha;
		return callAPI(token, apiPath + '/commits/' + lastCommitSha, null, 'GET');
	})
	.then(function (res) {
		var data = {
			base_tree: res.tree.sha,
			tree: tree
		};
		return callAPI(token, apiPath + '/trees', data, 'POST');
	})
	.then(function (res) {
		var data = {
			parents: [lastCommitSha],
			tree: res.sha,
			message: message
		};
		return callAPI(token, apiPath + '/commits', data, 'POST');
	})
	.then(function (res) {
		var data = {
			sha: res.sha
		};
		return callAPI(token, apiPath + '/refs/heads/' + branch, data, 'PATCH');
	});
}

/**
 * Create a branch with the given parameters
 * @param {GHSession} session - GH session
 * @param  {string} repo - Repository name where to create the branch
 * @param  {string} branchName - Name for the newly created branch
 * @param  {string} [fromBranch] - Branch to start the new branch from. Default to the default_branch of the repo
 * @return {Promise} a Promise of the API call result
 */
function createBranch(session, repo, branchName, fromBranch) {
	var apiPath = '/repos/' + session.gh_account.login + '/' + repo + '/git/refs';
	return callAPI(session.gh_token, apiPath + '/heads', null, 'GET')
	.then(function (res) {
		var reqData = {
			ref: 'refs/heads/' + branchName,
		}
		if(!fromBranch) reqData.sha = res[0].object.sha;
		else {
			var origin = res.filter(function(branch) {
			  return branch.ref === 'refs/heads/' + fromBranch;
			})[0];
			if(!origin) throw new Error('Unknown branch origin ' + fromBranch);
			reqData.sha = origin.object.sha;
		}
		return callAPI(session.gh_token, apiPath, reqData, 'POST');
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
 * @see https://developer.github.com/v3/git/trees/#create-a-tree
 */
function transformTree(session, repo, transformer, message, branch) {
	branch = branch || 'master';
	var lastCommitSha;
	var apiPath = '/repos/' + session.gh_account.login + '/' + repo;
	var token = session.gh_token;
	return callAPI(token, apiPath + '/git/refs/heads/' + branch, null, 'GET')
	.then(function(head) {
		lastCommitSha = head.object.sha;
		return callAPI(token, apiPath + '/git/trees/' + head.object.sha, {recursive: 1}, 'GET');
	})
	.then(function(res) {
		return transformer(res);
	})
	.then(function(tree) {
		if(Array.isArray(tree) && tree.length > 0){
			return callAPI(token, apiPath + '/git/trees', {tree: tree}, 'POST');
		}
		else if(Array.isArray(tree)){
			throw new Error('You can not leave this folder empty.');
		}
		else{
			throw new Error('Invalid tree transformation. Transformer must return an array.');
		}
	})
	.then(function(newTree) {
		data = {
			parents: [lastCommitSha],
			tree: newTree.sha,
			message: message
		};
		return callAPI(token, apiPath + '/git/commits', data, 'POST');
	})
	.then(function (res) {
		data = {
			sha: res.sha
		};
		return callAPI(token, apiPath + '/git/refs/heads/' + branch, data, 'PATCH');
	});
}

/**
 * Remove a file/folder
 * @param {GHSession} session - GH session
 * @param  {string} repo - Repository name where to create the branch
 * @param  {string} path - Path to the file/folder to delete
 * @param  {string} [branch=master] - Branch containing file/folder
 * @return {Promise} a Promise of the API call result
 */
function removeFile(session, repo, path, branch) {
	return transformTree(session, repo, function(results) {
		var regex = new RegExp('^' + path + '$|^' + path + '(\/)');
	  return results.tree.filter(function(file) {
	    return !regex.test(file.path);
	  })
	}, 'Remove ' + path, branch);
}

/**
 * Move a folder or a file in a branch
 * @param {GHSession} session - GH session
 * @param {string} repo - Name of the repository to commit
 * @param  {string} src - Source path relative to branch root
 * @param  {string} dest - Destination path relative to branch root
 * @param  {string} [branch=master] - Branch containing src and dest
 * @return {Promise} a Promise of the server response
 */
function move(session, repo, src, dest, branch) {
	return transformTree(session, repo, function(results) {
		return results.tree.map(function(file) {
			// ^test$|^test(\/)
			var regex = new RegExp('^' + src + '$|^' + src + '(\/)');
			return {
				path: file.path.replace(regex, dest + '$1'),
				sha: file.sha,
				mode: file.mode,
				type: file.type
			};
		});
	}, 'Move' + src + ' to ' + dest, branch);
}

/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
	// config
	exports.config = options.github;

  // form for local auth
  app.get(exports.config.AUTH_FORM_ROUTE, function(req, res, next){
		var code = url.parse(req.url, true).query.code;
    request({
			url: 'https://github.com/login/oauth/access_token',
			body: {
				client_id: exports.config.client_id,
				client_secret: exports.config.client_secret,
				code: code
			},
			json: true
		}, function (err, response, body) {
			if (err) {
				return res.end('{success:false, code:400, message:\'Error while calling GitHub API. ' + err +'\'}');
			}
			req.session.gh_token = body.access_token;
			callAPI(req.session.gh_token, '/user', null, 'GET')
			.then(function (result) {
				req.session.gh_account = {
					display_name: result.name,
					login: result.login,
					num_repos: result.public_repos
				};
				// res.end('{success: true, message: \'You are now logged in\', code: 200}');
				utils.displayLoginForm(200, res, options.ftp.LOGIN_TEMPLATE_PATH, options.ftp.LOGIN_CSS_PATH, {success: true});
			})
			.catch(function (err) {
				return res.end('{success:false, code:400, message:\'Error while calling GitHub API. ' + err +'\'}');
			});
		});
  });
}

/**
 * Connect to the service, i.e. ask for a request token.
 * The request token is required so that the user can allow our app to access his data.
 * Regenerate an auth link each time in order to avoid the expiration
 * Call the provided callback with these parameters
 *	@return 	{'success': true, authorize_url: 'https://www.dropbox.com/1/oauth/authorize?oauth_token=NMCS862sIG1mP'}
 *	@return 	{'success': false, message: Oups!'}
 */
exports.connect = function (request, response, next, cbk) {
  return cbk({success: true, authorize_url: 'https://github.com/login/oauth/authorize?scope=repo,delete_repo&client_id=' + exports.config.client_id});
}

/**
 * Login to the service, i.e. ask for an access token.
 * The access token is required to access the user data.
 * Call the provided callback with this data
 *    status    : {'success': true},
 */
exports.login = function (request, response, next, cbk) {
  if (isConnected(request)){
    cbk({success:true});
  }
  else{
    cbk({success:false, code: 401, message: 'User not authorized.'});
  }
}

/**
 * Logout from the service
 * Call the provided callback with this data
 *		status		: {'success': true},
 */
exports.logout = function (request, response, next, cbk) {
	if (isConnected(request)){
		delete request.session.gh_token;
		cbk({success:true, message:'Now logged out.'});
	}
	else{
		cbk({success:true, message:'Was not logged in.'});
	}
}

/**
 * Load the data associated with the current user account
 * Call the provided callback with this data
 *		status		: {'success': true},
 *		data 		{
 * 						display_name: 'Alexandre Hoyau',
 * 						login: 'lexoyo',
 *						num_repos: 42
 * 					}
 */
exports.getAccountInfo = function (req, res, next, cbk) {
	if (!isConnected(req)){
		cbk({success:false, code:401, message:'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		cbk({'success': true}, req.session.gh_account);
	}
}

/**
 * info about this service
 * @return an object with these attributes: display_name, description, visible. These attributes determine the response to the request /v1.0/services/list/
 */
exports.getInfo = function (request) {
	return {
		name: 'github', // det the root of the service
		display_name: 'GitHub',
		image_small: 'unifile-assets/services/github.png',
		description: 'Edit html files from your GitHub repository.',
		visible: true, // true if it should be listed in /v1.0/services/list/
		isLoggedIn: isConnected(request),
		isConnected: isConnected(request),
		isOAuth: true,
		user: request.session.gh_account
	};
}

// ******* commands

/**
 * List the files of a given folder
 * @param {string} path - Path to treeish to show: /repo/branch/folder/file
 * @result 	an object like this one:
 * {
 *   'status': {
 *     'success': true
 *   },
 *   'data': [
 *     {
 *       'bytes': 0,
 *       'modified': 'Thu, 03 Jan 2013 14:24:53 +0000',
 *       'title': 'name',
 *       'is_dir': true,
 *     },
 *
 *     ...
 *   ]
 * }
 *
 */
exports.ls = function (path, req, res, next, cbk) {
	if (!isConnected(req)){
		cbk({success:false, code:401, message:'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		var splitPath = getPathTokens(path);
		var resultPromise;
		switch (splitPath.length) {
			case 0: // List repos
				resultPromise = callAPI(req.session.gh_token, '/user/repos', {affiliation: 'owner'}, 'GET')
				.then(function (res) {
					return res.map(function(item) {
						return {
							bytes: item.size,
							modified: new Date(item.updated_at).toISOString(),
							name: item.name,
							is_dir: true
						};
					});
				});
				break;
			case 1:	// List all branches
				var apiPath = '/repos/' + req.session.gh_account.login + '/' + splitPath[0] + '/branches';
				resultPromise = callAPI(req.session.gh_token, apiPath, null, 'GET')
				.then(function (res) {
					return Promise.map(res, function(item) {
						return callAPI(req.session.gh_token, url.parse(item.commit.url).path, null, 'GET')
						.then(function(result) {
						  return result.commit.author.date;
						})
						.then(function(date) {
							return {
								bytes: 'N/A',
								modified: new Date(date).toISOString(),
								name: item.name,
								is_dir: true
							};
						});
					});
				});
				break;
			default: // List files of one branch
				var apiPath = '/repos/' + req.session.gh_account.login + '/' + splitPath[0];
				var filePath = splitPath.slice(2).join('/');
				var reqData = {
					ref: splitPath[1]
				};
				resultPromise = callAPI(req.session.gh_token, apiPath + '/contents/' + filePath, reqData, 'GET')
				.then(function(res) {
					return Promise.map(res, function(item) {
						return callAPI(req.session.gh_token, apiPath + '/commits', {path: item.path, sha: splitPath[1]}, 'GET')
						.then(function(result) {
							return result[0].commit.author.date;
						})
						.then(function(date) {
							return {
								bytes: item.size,
								modified: new Date(date).toISOString(),
								name: item.name,
								is_dir: item.type === 'dir'
							};
						});
					});
				});
		}

		resultPromise
		.then(function(list) {
		  cbk({success: true}, list);
		}, function(err){
			cbk({success: false, code: err.statusCode, message: 'Failed to list files and folder: ' + err});
		})
	}
}

/**
 * Create a folder
 * @return	an object with this attribute
 * {
 *   'status': {'success': true}
 * }
 */
exports.mkdir = function (path, request, response, next, cbk) {
	if (!isConnected(request)){
		cbk({success:false, code:401, message:'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		var splitPath = getPathTokens(path);
		var reqData = null;
		var apiPath;
		var apiPromise;
		switch (splitPath.length) {
			case 0: // Error
				return cbk({success:false, code:400, message:'Cannot create dir with an empty name.'});
			case 1: // Create a repo
				apiPath = '/user/repos';
				reqData = {
					name: splitPath[0],
					auto_init: true
				};
				apiPromise = callAPI(request.session.gh_token, apiPath, reqData, 'POST');
				break;
			case 2:	// Create a branch
				apiPromise = createBranch(request.session, splitPath[0], splitPath[1]);
				break;
			default: // Create a folder (with a .gitignore file in it because git doesn't track empty folder)
				var path = splitPath.slice(2).join('/');

				apiPath = '/repos/' + request.session.gh_account.login + '/' + splitPath[0] + '/contents/' + path;
				var reqData = {
					message: 'Create '+ path,
					content: new Buffer('').toString('base64'),
					branch: splitPath[1]
				}
				apiPromise = callAPI(request.session.gh_token, apiPath + '/.gitignore', reqData, 'PUT');
		}

		apiPromise.then(function (res) {
			cbk({success: true, code: 200, message: 'Folder created! ' + res.toString()});
		})
		.catch(function(err){
			return cbk({success:false, code: err.statusCode, message:'Cannot create a new folder. ' + err});
		});
	}
}

/**
 * Create the give file
 * @return	an object with this attribute
 * {
 *   'status': {'success': true}
 * }
 */
exports.put = function (path, data, request, response, next, cbk) {
	if (!isConnected(request)){
		cbk({success:false, code:401, message:'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		var splitPath = getPathTokens(path);
		if (splitPath.length < 3) {
			return cbk({success: false, message: 'This folder can only contain folders. Files can go in sub-folders.'});
		}
		var filePath = splitPath.slice(2).join('/');
		var buffer = Buffer.isBuffer(data) ? data : new Buffer(data);
		var apiPath = '/repos/' + request.session.gh_account.login + '/' + splitPath[0] + '/git/blobs';
		callAPI(request.session.gh_token, apiPath, {
			content: buffer.toString('base64'),
			encoding: 'base64'
		}, 'POST')
		.then(function(result) {
			return commit(request.session, splitPath[0], [{
				path: filePath,
				sha: result.sha,
				mode: '100644',
				type: 'blob'
			}], 'Create ' + splitPath.slice(2).join('/'), splitPath[1]);
		})
		.then(function(res){
			cbk({success:true});
		})
		.catch(function(err){
			cbk({success:false, message: err});
		})

	}
}

/**
 * Get the give file, output its content
 * @return	the content of the file if there is no error
 * @return	an object with this attribute
 * {
 *   'status': {'success': false}
 * }
 */
exports.get = function (path, request, response, next, cbk) {
	if (!isConnected(request)){
		cbk({success:false, code:401, message:'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		var splitPath = getPathTokens(path);
		if (splitPath.length < 3) {
			return cbk({success: false, message: 'This folder only contain folders. Files can be found in sub-folders.'});
		}
		var apiPath = '/repos/' + request.session.gh_account.login + '/' + splitPath[0] + '/contents/';
		apiPath += splitPath.slice(2).join('/');
		callAPI(request.session.gh_token, apiPath, {ref: splitPath[1]}, 'GET')
		.then(function(res){
			if (res.type === 'file') {
				cbk({success:true}, new Buffer(res.content, res.encoding), mime.lookup(res.name));
			}
			else {
				cbk({success:true}, res.map(function(sub){return sub.name}));
			}
		})
		.catch(function(err){
			cbk({success: false, code: err.statusCode, message: err});
		});
	}
}

/**
 * Move or rename a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mv = function (src, dest, request, response, next, cbk) {
	if (!isConnected(request)){
		cbk({success: false, code: 401, message: 'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		var token = request.session.gh_token;
		var splitPath = getPathTokens(src);
		var splitPathDest = getPathTokens(dest);
		var apiPromise;
		switch (splitPath.length) {
			case 0: // Error
				return cbk({success:false, code:400, message:'Cannot move dir with an empty name.'});
			case 1: // Rename repo
				var apiPath = '/repos/' + request.session.gh_account.login + '/' + splitPath[0];
				reqData = {name: dest};
				apiPromise = callAPI(token, apiPath, reqData, 'PATCH');
				break;
			case 2:	// Rename branch (actually copy src to dest then remove src)
				var apiPath = '/repos/' + request.session.gh_account.login + '/' + splitPath[0] + '/git/refs/heads/';
				apiPromise = createBranch(request.session, splitPath[0], splitPathDest[1], splitPath[1])
				.then(function() {
				  return callAPI(token, apiPath + splitPath[1], null, 'DELETE');
				});
				break;
			default: // Rename a file/folder
				apiPromise = move(request.session, splitPath[0], splitPath.slice(2).join('/'), splitPathDest.slice(2).join('/'), splitPath[1]);

		}

		apiPromise.then(function (res) {
			cbk({success: true, code: 200, message: 'Folder moved to ' + dest});
		})
		.catch(function(err){
			cbk({success:false, code: err.statusCode, message:'Cannot move folder. ' + err});
		});
	}
}

/**
 * delete a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.rm = function (path, request, response, next, cbk) {
	if (!isConnected(request)){
		cbk({success:false, code:401, message:'User not logged in yet. You need to call the \'login\' service first.'});
	}
	else{
		var splitPath = getPathTokens(path);
		var repoPath = '/repos/' + request.session.gh_account.login + '/' + splitPath[0];
		var resultPromise;
		switch (splitPath.length) {
			case 0: // Error
				return cbk({success:false, code:400, message:'Cannot remove dir with an empty name.'});
			case 1: // Remove repo
				resultPromise = callAPI(request.session.gh_token, repoPath, null, 'DELETE');
				break;
			case 2:	// Remove branch
				resultPromise = callAPI(request.session.gh_token, repoPath + '/branches', null, 'GET')
				.then(function(branches) {
					if(branches.length > 1)
						return callAPI(request.session.gh_token, repoPath + '/git/refs/heads/' + splitPath[1], null, 'DELETE');
					else{
						var err = new Error('You can not leave this folder empty.');
						err.statusCode = 400;
						throw err;
					}
				});
				break;
			default: // Remove file/folder
				resultPromise = removeFile(request.session, splitPath[0], splitPath.slice(2).join('/'), splitPath[1]);
		}
		resultPromise
		.then(function(list) {
		  cbk({success: true});
		}, function(err){
			cbk({success: false, code: err.statusCode, message: 'Failed to remove file: ' + err});
		})
	}
}
