'use strict';

var url = require('url');

var request = require('request');
var Promise = require('bluebird');

const NAME = 'GitHub';
const GH_OAUTH_URL = 'https://github.com/login/oauth';
const APP_PERMISSION = 'scope=repo,delete_repo';

/*
 * Remove first '/', split the path and remove empty tokens
 * @param {String} path - Path to split
 * @return {Array<String>} an array with path levels as elements
 */
function getPathTokens(path) {
  return path.substr(1).split('/').filter((s) => s !== '');
}

/**
 * Handle GitHub pagination
 * @param  {Object} reqOptions - Options to pass to the request. Url will be overidden
 * @param  {string} link - Link header
 * @param  {Object[]} memo - Aggregator of result
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
 * Create a branch with the given parameters
 * @param {GHSession} session - GH session
 * @param  {string} repo - Repository name where to create the branch
 * @param  {string} branchName - Name for the newly created branch
 * @param  {string} [fromBranch] - Branch to start the new branch from. Default to the default_branch of the repo
 * @return {Promise} a Promise of the API call result
 */
function createBranch(session, repo, branchName, fromBranch) {
  var apiPath = '/repos/' + session.account.login + '/' + repo + '/git/refs';
  return callAPI(session.token, apiPath + '/heads', null, 'GET')
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
    return callAPI(session.token, apiPath, reqData, 'POST');
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
 *
* */
function commit(session, repo, tree, message, branch) {
  var apiPath = '/repos/' + session.account.login + '/' + repo + '/git';
  var token = session.token;
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
  var apiPath = '/repos/' + session.account.login + '/' + repo;
  var token = session.token;
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
      return Promise.reject('You can not leave this folder empty.');
    }
    else{
      return Promise.reject('Invalid tree transformation. Transformer must return an array.');
    }
  })
  .then(function(newTree) {
    let data = {
      parents: [lastCommitSha],
      tree: newTree.sha,
      message: message
    };
    return callAPI(token, apiPath + '/git/commits', data, 'POST');
  })
  .then(function (res) {
    let data = {
      sha: res.sha
    };
    return callAPI(token, apiPath + '/git/refs/heads/' + branch, data, 'PATCH');
  });
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
    }, 'Move ' + src + ' to ' + dest, branch);
}

/**
 * Make a call to the GitHub API
 * @param {string] token - Access token to the API
 * @param {string} path - End point path
 * @param {Object} data - Data to pass. Convert to querystring if method is GET or to the request body
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
  //console.log('Calling', reqOptions.url, 'with', data);
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
        var result = res.statusCode !== 204 ? JSON.parse(body) : null;
        if(res.headers.hasOwnProperty('link')){
          paginate(reqOptions, res.headers.link, result).then(resolve);
        }
        else resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

class GitHubConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
    this.isConnected = false;
    this.session = new Map();
  }

  login(loginInfos){
    if(loginInfos.state !== this.config.state) return Promise.reject('Invalid request (cross-site request)');

    this.isConnected = true;
    return new Promise((resolve, reject) => {
      request({
        url: GH_OAUTH_URL + '/access_token',
        method: 'POST',
        body: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: loginInfos.code,
          state: this.config.state
        },
        json: true
      }, function (err, response, body) {
        if (err) return reject('Error while calling GitHub API. ' + err);

        return resolve(body.access_token);
      });
    })
    .then((token) => {
      this.session.token = token;
    })
    .then(() => {
      return callAPI(this.session.token, '/user', null, 'GET');
    })
    .then((result) => {
      this.session.account = {
       display_name: result.name,
       login: result.login,
       num_repos: result.public_repos
      };
    });
  }

  getAuthorizeURL() {
    return GH_OAUTH_URL + '/authorize?' + APP_PERMISSION + '&client_id=' + this.config.clientId + '&state=' + this.config.state;
  }

  ls(path){
    if (!this.isConnected){
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    }
    else{
      var splitPath = getPathTokens(path);
      var resultPromise;
      switch (splitPath.length) {
        case 0: // List repos
          resultPromise = callAPI(this.session.token, '/user/repos', {affiliation: 'owner'}, 'GET')
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
        case 1: // List all branches
          var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0] + '/branches';
          resultPromise = callAPI(this.session.token, apiPath, null, 'GET')
          .bind(this)
          .then(function (res) {
            return Promise.map(res, function(item) {
              return callAPI(this.session.token, url.parse(item.commit.url).path, null, 'GET')
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
            }.bind(this));
          });
          break;
        default: // List files of one branch
          var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0];
          var filePath = splitPath.slice(2).join('/');
          var reqData = {
            ref: splitPath[1]
          };
          resultPromise = callAPI(this.session.token, apiPath + '/contents/' + filePath, reqData, 'GET')
          .then(function(res) {
            return Promise.map(res, function(item) {
              return callAPI(this.session.token, apiPath + '/commits', {path: item.path, sha: splitPath[1]}, 'GET')
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
            }.bind(this));
          }.bind(this));
      }

      return resultPromise;
    }
  }

  mkdir(path){
    if (!this.isConnected){
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    }
    else{
      var splitPath = getPathTokens(path);
      var reqData = null;
      var apiPath;
      var apiPromise;
      switch (splitPath.length) {
        case 0: // Error
          return Promise.reject('Cannot create dir with an empty name.');
        case 1: // Create a repo
          apiPath = '/user/repos';
          reqData = {
            name: splitPath[0],
            auto_init: true
          };
          apiPromise = callAPI(this.session.token, apiPath, reqData, 'POST');
          break;
        case 2: // Create a branch
          apiPromise = createBranch(this.session, splitPath[0], splitPath[1]);
          break;
        default: // Create a folder (with a .gitignore file in it because git doesn't track empty folder)
          var path = splitPath.slice(2).join('/');

          apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0] + '/contents/' + path;
          var reqData = {
            message: 'Create '+ path,
            content: new Buffer('').toString('base64'),
            branch: splitPath[1]
          }
          apiPromise = callAPI(this.session.token, apiPath + '/.gitignore', reqData, 'PUT');
      }

      return apiPromise;
    }
  }

  put(path, data) {
    if (!this.isConnected){
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    }
    else{
      var splitPath = getPathTokens(path);
      if (splitPath.length < 3) {
        return Promise.reject('This folder can only contain folders. Files can go in sub-folders.');
      }
      var filePath = splitPath.slice(2).join('/');
      var buffer = Buffer.isBuffer(data) ? data : new Buffer(data);
      var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0] + '/git/blobs';
      return callAPI(this.session.token, apiPath, {
        content: buffer.toString('base64'),
        encoding: 'base64'
      }, 'POST')
      .bind(this)
      .then(function(result) {
        return commit(this.session, splitPath[0], [{
          path: filePath,
          sha: result.sha,
          mode: '100644',
          type: 'blob'
        }], 'Create ' + splitPath.slice(2).join('/'), splitPath[1]);
      });
    }
  }

  get(path) {
    if (!this.isConnected){
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    }
    else{
      var splitPath = getPathTokens(path);
      if (splitPath.length < 3) {
        return Promise.reject('This folder only contain folders. Files can be found in sub-folders.');
      }
      var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0] + '/contents/';
      apiPath += splitPath.slice(2).join('/');
      return callAPI(this.session.token, apiPath, {ref: splitPath[1]}, 'GET')
      .then(function(res){
        if (res.type === 'file') {
          return new Buffer(res.content, res.encoding).toString();//, mime.lookup(res.name);
        }
        else {
          return res.map(function(sub){return sub.name});
        }
      });
    }
  }

  mv(src, dest) {
    if (!this.isConnected){
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    }
    else{
      var splitPath = getPathTokens(src);
      var splitPathDest = getPathTokens(dest);
      var apiPromise;
      switch (splitPath.length) {
        case 0: // Error
          return Promise.reject('Cannot move dir with an empty name.');
        case 1: // Rename repo
          var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0];
          reqData = {name: dest};
          return apiPromise = callAPI(this.session.token, apiPath, reqData, 'PATCH');
          break;
        case 2: // Rename branch (actually copy src to dest then remove src)
          var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0] + '/git/refs/heads/';
          return apiPromise = createBranch(request.session, splitPath[0], splitPathDest[1], splitPath[1])
          .then(function() {
            return callAPI(this.session.token, apiPath + splitPath[1], null, 'DELETE');
          });
          break;
        default: // Rename a file/folder
          return apiPromise = move(this.session, splitPath[0], splitPath.slice(2).join('/'), splitPathDest.slice(2).join('/'), splitPath[1]);
      }
    }
  }
}

module.exports = GitHubConnector;
