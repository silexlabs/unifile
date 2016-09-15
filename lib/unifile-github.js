'use strict';

const url = require('url');

const request = require('request');
const Promise = require('bluebird');
const mime = require('mime');

const NAME = 'github';
const GH_OAUTH_URL = 'https://github.com/login/oauth';
const APP_PERMISSION = 'scope=repo,delete_repo';

/*
 * Remove first '/', split the path and remove empty tokens
 * @param {String} path - Path to split
 * @return {Array<String>} an array with path levels as elements
 */
function getPathTokens(path) {
  if(path.startsWith('/')) path = path.substr(1);
  return path.split('/').filter((s) => s !== '');
}

/**
 * Handle GitHub pagination
 * @param  {Object} reqOptions - Options to pass to the request. Url will be overidden
 * @param  {string} link - Link header
 * @param  {Object[]} memo - Aggregator of result
 * @return {Promise} a Promise of aggregated result
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
  const apiPath = '/repos/' + session.account.login + '/' + repo + '/git/refs';
  return callAPI(session, apiPath + '/heads', null, 'GET')
    .then(function(res) {
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
      return callAPI(session, apiPath, reqData, 'POST');
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
  const apiPath = '/repos/' + session.account.login + '/' + repo + '/git';
  let lastCommitSha;

  // Get branch head
  return callAPI(session, apiPath + '/refs/heads/' + branch, null, 'GET')
    .then(function(res) {
      lastCommitSha = res.object.sha;
    // Get last commit info
      return callAPI(session, apiPath + '/commits/' + lastCommitSha, null, 'GET');
    })
    .then(function(res) {
      const data = {
        base_tree: res.tree.sha,
        tree: tree
      };
    // Create a new tree
      return callAPI(session, apiPath + '/trees', data, 'POST');
    })
    .then(function(res) {
      const data = {
        parents: [lastCommitSha],
        tree: res.sha,
        message: message
      };
    // Create a new commit with the new tree
      return callAPI(session, apiPath + '/commits', data, 'POST');
    })
    .then(function(res) {
      const data = {
        sha: res.sha
      };
    // Update head
      return callAPI(session, apiPath + '/refs/heads/' + branch, data, 'PATCH');
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
  let lastCommitSha;
  const apiPath = '/repos/' + session.account.login + '/' + repo;
  return callAPI(session, apiPath + '/git/refs/heads/' + branch, null, 'GET')
    .then(function(head) {
      lastCommitSha = head.object.sha;
      return callAPI(session, apiPath + '/git/trees/' + head.object.sha, {recursive: 1}, 'GET');
    })
    .then(function(res) {
      return transformer(res);
    })
    .then(function(tree) {
      if(Array.isArray(tree) && tree.length > 0) {
        return callAPI(session, apiPath + '/git/trees', {tree: tree}, 'POST');
      } else if(Array.isArray(tree)) {
        return Promise.reject('You can not leave this folder empty.');
      } else {
        return Promise.reject('Invalid tree transformation. Transformer must return an array.');
      }
    })
    .then(function(newTree) {
      const data = {
        parents: [lastCommitSha],
        tree: newTree.sha,
        message: message
      };
      return callAPI(session, apiPath + '/git/commits', data, 'POST');
    })
    .then(function(res) {
      const data = {
        sha: res.sha
      };
      return callAPI(session, apiPath + '/git/refs/heads/' + branch, data, 'PATCH');
    });
}

/**
 * Move a folder or a file in a branch by transforming the given tree
 * @param  {string} src - Source path relative to branch root
 * @param  {string} dest - Destination path relative to branch root
 * @param  {Object} treeRes[].tree - Commit tree
 * @param  {string} [branch=master] - Branch containing file/folder
 */
function move(src, dest, treeRes) {
  return treeRes.tree.map(function(file) {
    // ^test$|^test(\/)
    const regex = new RegExp('^' + src + '$|^' + src + '(\/)');
    return {
      path: file.path.replace(regex, dest + '$1'),
      sha: file.sha,
      mode: file.mode,
      type: file.type
    };
  });
}

/**
 * Remove a file/folder by transforming the given tree
 * @param  {string} path - Path to the file/folder to delete
 * @param  {Object} treeRes - Result of a GET request to the tree API
 * @param  {Object} treeRes[].tree - Commit tree
 * @param  {string} [branch=master] - Branch containing file/folder
 */
function removeFile(path, treeRes) {
  const regex = new RegExp('^' + path + '$|^' + path + '(\/)');
  return treeRes.tree.filter(function(file) {
    return !regex.test(file.path);
  });
}

/**
 * Create a blob in the designated repository
 * @param {Object} session - GitHub session storage
 * @param {string} repoName - Name of the repository where to create the blob
 * @param {string|Buffer} content - Content of the blob
 * @return {Promise} a promise of result for the blob creation
 *
 * @see https://developer.github.com/v3/git/blobs/#create-a-blob
 */
function createBlob(session, repoName, content) {
  const buffer = Buffer.isBuffer(content) ? content : new Buffer(content);
  const apiPath = '/repos/' + session.account.login + '/' + repoName + '/git/blobs';
  return callAPI(session, apiPath, {
    content: buffer.toString('base64'),
    encoding: 'base64'
  }, 'POST');
}

/**
 * Make a call to the GitHub API and get the response as a Stream
 * @param {string} token - Access token to the API
 * @param {string} path - End point path
 * @param {string} qs - Querystring to add to the request
 * @param {string} method - HTTP verb to use
 * @return {Stream} a stream of the request
 */
function streamAPI(token, path, qs, method) {
  const reqOptions = {
    url: 'https://api.github.com' + path,
    method: method,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': 'token ' + token,
      'User-Agent': 'Unifile'
    },
    qs: qs
  };
  return request(reqOptions);
}

/**
 * Make a call to the GitHub API
 * @param {Object} session - GitHub session storage
 * @param {string} path - End point path
 * @param {Object} data - Data to pass. Convert to querystring if method is GET or to the request body
 * @param {string} method - HTTP verb to use
 * @return {Promise} a Promise of the result send by server
 */
function callAPI(session, path, data, method) {
  let authorization;
  if(session.basic) authorization = 'Basic ' + session.basic;
  else authorization = 'token ' + session.token;

  const reqOptions = {
    url: 'https://api.github.com' + path,
    method: method,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': authorization,
      'User-Agent': 'Unifile'
    }
  };

  method === 'GET' ? reqOptions.qs = data : reqOptions.body = JSON.stringify(data);
  //console.log('Calling', reqOptions.url, 'with', data, '/ auth:', authorization);
  return new Promise(function(resolve, reject) {
    request(reqOptions, function(err, res, body) {
      if(err) {
        return reject(err);
      }
      if(res.statusCode >= 400) {
        const error = new Error(JSON.parse(body).message);
        error.statusCode = res.statusCode;
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

class GitHubConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'GitHub',
      icon: '../assets/github.png',
      description: 'Edit html files from your GitHub repository.',
      isLoggedIn: (session && 'token' in session),
      isOAuth: true,
      username: session.account.display_name
    };
  }

  login(session, loginInfos) {
    if(loginInfos.state !== this.config.state) return Promise.reject('Invalid request (cross-site request)');

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
      }, function(err, response, body) {
        if(err) return reject('Error while calling GitHub API. ' + err);

        return resolve(body.access_token);
      });
    })
      .then((token) => {
        return this.setAccessToken(session, token);
      });
  }

  setBasicAuth(session, username, password) {
    session.basic = new Buffer(username + ':' + password, 'ascii').toString('base64');
    return callAPI(session, '/user', null, 'GET')
      .then((result) => {
        session.account = {
          display_name: result.name,
          login: result.login,
          num_repos: result.public_repos
        };
        return username;
      });
  }

  setAccessToken(session, token) {
    session.token = token;
    return callAPI(session, '/user', null, 'GET')
      .then((result) => {
        session.account = {
          display_name: result.name,
          login: result.login,
          num_repos: result.public_repos
        };
        return session.token;
      });
  }

  clearAccessToken(session) {
    session.token = null;
    session.account = null;
    return Promise.resolve();
  }

  getAuthorizeURL() {
    return Promise.resolve(GH_OAUTH_URL
      + '/authorize?' + APP_PERMISSION
      + '&client_id=' + this.config.clientId
      + '&state=' + this.config.state);
  }

  //Filesystem commands

  readdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(path);
      let resultPromise;
      let apiPath;
      switch (splitPath.length) {
        case 0: // List repos
          resultPromise = callAPI(session, '/user/repos', {affiliation: 'owner'}, 'GET')
          .then(function(res) {
            return res.map(function(item) {
              return {
                size: item.size,
                modified: new Date(item.updated_at).toISOString(),
                name: item.name,
                isDir: true,
                mime: 'application/git-repo'
              };
            });
          });
          break;
        case 1: // List all branches
          apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/branches';
          resultPromise = callAPI(session, apiPath, null, 'GET')
          .then((res) => {
            return Promise.map(res, (item) => {
              return callAPI(session, url.parse(item.commit.url).path, null, 'GET')
              .then(function(result) {
                return result.commit.author.date;
              })
              .then(function(date) {
                return {
                  size: 'N/A',
                  modified: new Date(date).toISOString(),
                  name: item.name,
                  isDir: true,
                  mime: 'application/git-branch'
                };
              });
            });
          });
          break;
        default: // List files of one branch
          apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
          const filePath = splitPath.slice(2).join('/');
          const reqData = {
            ref: splitPath[1]
          };
          resultPromise = callAPI(session, apiPath + '/contents/' + filePath, reqData, 'GET')
          .then((res) => {
            return Promise.map(res, (item) => {
              return callAPI(session, apiPath + '/commits', {path: item.path, sha: splitPath[1]}, 'GET')
              .then(function(result) {
                return result[0].commit.author.date;
              })
              .then(function(date) {
                return {
                  size: item.size,
                  modified: new Date(date).toISOString(),
                  name: item.name,
                  isDir: item.type === 'dir',
                  mime: mime.lookup(item.name)
                };
              });
            });
          });
      }

      return resultPromise;
    }
  }

  mkdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(path);
      let reqData = null;
      let apiPath;
      let apiPromise;
      switch (splitPath.length) {
        case 0: // Error
          return Promise.reject('Cannot create dir with an empty name.');
        case 1: // Create a repo
          apiPath = '/user/repos';
          reqData = {
            name: splitPath[0],
            auto_init: true
          };
          apiPromise = callAPI(session, apiPath, reqData, 'POST');
          break;
        case 2: // Create a branch
          apiPromise = createBranch(session, splitPath[0], splitPath[1]);
          break;
        default: // Create a folder (with a .gitkeep file in it because git doesn't track empty folder)
          const path = splitPath.slice(2).join('/');

          apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/contents/' + path;
          reqData = {
            message: 'Create ' + path,
            content: new Buffer('').toString('base64'),
            branch: splitPath[1]
          };
          apiPromise = callAPI(session, apiPath + '/.gitkeep', reqData, 'PUT');
      }

      return apiPromise;
    }
  }

  writeFile(session, path, data) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(path);
      if(splitPath.length < 3) {
        return Promise.reject('This folder can only contain folders. Files can go in sub-folders.');
      }
      createBlob(session, splitPath[0], data)
        .then((result) => {
          return commit(session, splitPath[0], [{
            path: splitPath.slice(2).join('/'),
            sha: result.sha,
            mode: '100644',
            type: 'blob'
          }], 'Create ' + splitPath.slice(2).join('/'), splitPath[1]);
        });
    }
  }

  createWriteStream(session, path) {
    if(!session.token)
      throw 'User not logged in yet. You need to call the login() first.';

    const splitPath = getPathTokens(path);
    const apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/git/blobs';
    const stream = streamAPI(session.token, apiPath, {}, 'POST');
    // Commit the blob when all the data has been written
    stream.on('data', (data) => {
      const result = JSON.parse(data.toString());
      return commit(session, splitPath[0], [{
        path: splitPath.slice(2).join('/'),
        sha: result.sha,
        mode: '100644',
        type: 'blob'
      }], 'Create ' + splitPath.slice(2).join('/'), splitPath[1]);
    });

    return stream;
  }

  readFile(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(path);
      if(splitPath.length < 3) {
        return Promise.reject('This folder only contain folders. Files can be found in sub-folders.');
      }
      const apiPath = '/repos/' + session.account.login
      + '/' + splitPath[0] + '/contents/'
      + splitPath.slice(2).join('/');

      return callAPI(session, apiPath, {ref: splitPath[1]}, 'GET')
        .then(function(res) {
          if(res.type === 'file') {
            return new Buffer(res.content, res.encoding).toString();//, mime.lookup(res.name);
          } else {
            return res.map(function(sub) {return sub.name;});
          }
        });
    }
  }

  createReadStream(session, path) {
    if(!session.token)
      throw 'User not logged in yet. You need to call the login() first.';

    const splitPath = getPathTokens(path);
    const apiPath = '/repos/' + session.account.login
    + '/' + splitPath[0] + '/contents/'
    + splitPath.slice(2).join('/');

    return streamAPI(session.token, apiPath, {ref: splitPath[1]}, 'GET');
  }

  rename(session, src, dest) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(src);
      const splitPathDest = getPathTokens(dest);
      let apiPath;
      switch (splitPath.length) {
        case 0: // Error
          return Promise.reject('Cannot move dir with an empty name.');
        case 1: // Rename repo
          apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
          const reqData = {name: dest};
          return callAPI(session, apiPath, reqData, 'PATCH');
        case 2: // Rename branch (actually copy src to dest then remove src)
          apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/git/refs/heads/';
          return createBranch(session, splitPath[0], splitPathDest[1], splitPath[1])
            .then(function() {
              return callAPI(session, apiPath + splitPath[1], null, 'DELETE');
            });
        default: // Rename a file/folder
          const src = splitPath.slice(2).join('/');
          const dest = splitPathDest.slice(2).join('/');
          return transformTree(session, splitPath[0], move.bind(undefined, src, dest),
            'Move ' + src + ' to ' + dest, splitPath[1]);
      }
    }
  }

  unlink(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(path);
      const repoPath = '/repos/' + session.account.login + '/' + splitPath[0];
      switch (splitPath.length) {
        case 0: // Error
          return Promise.reject('Cannot remove dir with an empty name.');
        case 1: // Remove repo
          return callAPI(session, repoPath, null, 'DELETE');
        case 2: // Remove branch
          return callAPI(session, repoPath + '/branches', null, 'GET')
            .then((branches) => {
              if(branches.length > 1)
                return callAPI(session, repoPath + '/git/refs/heads/' + splitPath[1], null, 'DELETE');
              else {
                const err = new Error('You can not leave this folder empty.');
                err.statusCode = 400;
                throw err;
              }
            });
        default: // Remove file/folder
          const path = splitPath.slice(2).join('/');
          return transformTree(session, splitPath[0], removeFile.bind(undefined, path), 'Remove ' + path, splitPath[1]);
      }
    }
  }

  rmdir(session, path) {
    return this.unlink(session, path);
  }

  batch(session, actions, message) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const splitPath = getPathTokens(actions[0].path);
      return transformTree(session, splitPath[0], function(treeRes) {
        for(const action of actions) {
          const splitPath = getPathTokens(action.path);
          // Reject if its not a file or folder
          if(splitPath.length < 3) return Promise.reject('Cannot execute bash request on repositories or branches');

          const path = splitPath.slice(2).join('/');
          switch (action.name.toLowerCase()) {
            case 'unlink':
            case 'rmdir':
              treeRes.tree = removeFile(path, treeRes);
              break;
            case 'rename':
              const src = path;
              const dest = getPathTokens(action.destination).slice(2).join('/');
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
              treeRes.tree.push({
                path: path,
                content: action.content,
                mode: '100644',
                type: 'blob'
              });
              break;
            default:
              console.warn(`Unsupported batch action: ${action.name}`);
          }
        }
        return treeRes.tree;
      }, message || 'Batch update', splitPath[1]);
    }
  }
}

module.exports = GitHubConnector;
