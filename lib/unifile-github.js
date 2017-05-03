'use strict';

const Url = require('url');
const Writable = require('stream').Writable;
const Transform = require('stream').Transform;

const request = require('request');
const Promise = require('bluebird');
const Mime = require('mime');

const NAME = 'github';
const SERVICE_HOST = 'github.com';
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
      memo = memo.concat(JSON.parse(body));
      paginate(reqOptions, res.headers.link, memo).then(resolve);
    });
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

const createBranch = Symbol('createBranch');
const commit = Symbol('commit');
const transformTree = Symbol('transformTree');
const createBlob = Symbol('createBlob');
const assignSessionAccount = Symbol('assignSessionAccount');
const commitBlob = Symbol('commitBlob');
const callAPI = Symbol('callAPI');

class GitHubConnector {
  /**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - GitHub application client ID
   * @param {string} config.clientSecret - GitHub application client secret
   * @param {string} [config.redirectUri] - GitHub application redirect URI.
   *                                        You still need to register it in your GitHub App
   * @param {string} [config.name=github] - Name of the connector
   * @param {string} [config.serviceHost=github.com'] - Hostname of the service
   * @see GitHub OAuth Web Application Flow: https://developer.github.com/v3/oauth/#web-application-flow
   */
  constructor(config) {
    if(!config || !config.clientId || !config.clientSecret)
      throw new Error('Invalid configuration. Please refer to the documentation to get the required fields.');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.name = config.name || NAME;
    this.serviceHost = config.serviceHost || SERVICE_HOST;
    this.oauthCallbackUrl = `https://${this.serviceHost}/login/oauth`;
    this.redirectUri = config.redirectUri || null;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'GitHub',
      icon: '../assets/github.png',
      description: 'Edit html files from your GitHub repository.',
      isLoggedIn: !!(session && ('token' in session) || ('basic' in session)),
      isOAuth: true,
      username: (session && session.account) ? session.account.display_name : 'n/a'
    };
  }

  login(session, loginInfos) {
    // Authenticated URL
    if(loginInfos.constructor === String) {
      const url = Url.parse(loginInfos);
      if(!url.auth)
        return Promise.reject('Invalid URL. You must provide authentication: http://user:pwd@host');
      this.serviceHost = url.host || this.serviceHost;
      return this.setAccessToken(session, `Basic ${new Buffer(url.auth).toString('base64')}`);

    // Basic auth
    } else if('user' in loginInfos && 'password' in loginInfos) {
      const auth = new Buffer(loginInfos.username + ':' + loginInfos.password).toString('base64');
      return this.setAccessToken(session, `Basic ${auth}`);

    // OAuth
    } else if('state' in loginInfos && 'code' in loginInfos) {
      if(loginInfos.state !== session.state) return Promise.reject('Invalid request (cross-site request)');

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
          if(err) reject('Error while calling GitHub API. ' + err);
          else if(response.statusCode >= 400) reject('Unable to get access token. Please check you credentials.');
          else resolve(body.access_token);
        });
      })
      .then((token) => {
        return this.setAccessToken(session, `token ${token}`);
      });
    } else {
      return Promise.reject('Invalid credentials');
    }
  }

  setAccessToken(session, token) {
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
    session.token = null;
    session.account = null;
    return Promise.resolve();
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
      case 0: resultPromise = Promise.reject('You must provide a path to stat');
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
        apiPromise = this[callAPI](session, apiPath, reqData, 'POST');
        break;
      case 2: // Create a branch
        apiPromise = this[createBranch](session, splitPath[0], splitPath[1]);
        break;
      default: // Create a folder (with a .gitkeep file in it because git doesn't track empty folder)
        if(!session.account || !session.account.login)
          return Promise.reject('User account login is not set. Did you called login()?');
        const path = splitPath.slice(2).join('/');

        apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/contents/' + path;
        reqData = {
          message: 'Create ' + path,
          content: new Buffer('').toString('base64'),
          branch: splitPath[1]
        };
        apiPromise = this[callAPI](session, apiPath + '/.gitkeep', reqData, 'PUT');
    }

    return apiPromise;
  }

  writeFile(session, path, data) {
    const splitPath = getPathTokens(path);
    if(splitPath.length < 3) {
      return Promise.reject('This folder can only contain folders. Files can go in sub-folders.');
    }
    this[createBlob](session, splitPath[0], data)
    .then((blob) => {
      this[commitBlob](session, splitPath, blob);
    });
  }

  createWriteStream(session, path) {

    const splitPath = getPathTokens(path);
    const apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/git/blobs';
    // This will encapsulate the raw content into an acceptable Blob request
    const transformer = new Transform({
      transform(chunk, encoding, callback) {
        if(this.first) {
          this.push('{"encoding": "base64", "content": "');
          this.first = false;
        }
        callback(null, chunk);
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
      return this[commitBlob](session, splitPath, JSON.parse(Buffer.concat(chunks).toString()));
    });

    return transformer;
  }

  readFile(session, path, isStream = false) {
    const splitPath = getPathTokens(path);
    if(splitPath.length < 3) {
      return Promise.reject('This folder only contain folders. Files can be found in sub-folders.');
    }
    const apiPath = '/repos/' + session.account.login
    + '/' + splitPath[0] + '/contents/'
    + splitPath.slice(2).join('/');

    var promise = this[callAPI](session, apiPath, {ref: splitPath[1]}, 'GET', isStream);
    if(isStream) return promise;
    else {
      return promise.then(function(res) {
        if(res.type === 'file') {
          return new Buffer(res.content, res.encoding).toString();//, Mime.lookup(res.name);
        } else {
          return res.map(function(sub) {return sub.name;});
        }
      });
    }
  }

  createReadStream(session, path) {
    const transformer = new Transform({
      transform(chunk, encoding, callback) {
        const data = chunk.toString();
        if(this.isContent) {
          // return all the content until a " shows up
          callback(null, data.split('"')[0]);
        } else {
          // TODO better start detection
          const token = 'content":"';
          const idx = data.indexOf(token);
          if(idx > -1) {
            this.isContent = true;
            // Content detected, returns it until "
            callback(null, data.substr(idx + token.length).split('"')[0]);
          } else {
            // Drop content
            callback(null);
          }
        }
      }
    });
    transformer.isContent = false;
    return this.readFile(session, path, true).pipe(transformer);
  }

  rename(session, src, dest) {
    const splitPath = getPathTokens(src);
    const splitPathDest = getPathTokens(dest);
    let apiPath;
    switch (splitPath.length) {
      case 0: // Error
        return Promise.reject('Cannot move dir with an empty name.');
      case 1: // Rename repo
        apiPath = '/repos/' + session.account.login + '/' + splitPath[0];
        const reqData = {name: dest};
        return this[callAPI](session, apiPath, reqData, 'PATCH');
      case 2: // Rename branch (actually copy src to dest then remove src)
        apiPath = '/repos/' + session.account.login + '/' + splitPath[0] + '/git/refs/heads/';
        return this[createBranch](session, splitPath[0], splitPathDest[1], splitPath[1])
        .then(function() {
          return this[callAPI](session, apiPath + splitPath[1], null, 'DELETE');
        });
      default: // Rename a file/folder
        const src = splitPath.slice(2).join('/');
        const dest = splitPathDest.slice(2).join('/');
        return this[transformTree](session, splitPath[0], move.bind(undefined, src, dest),
          'Move ' + src + ' to ' + dest, splitPath[1]);
    }
  }

  unlink(session, path) {
    const splitPath = getPathTokens(path);
    const repoPath = '/repos/' + session.account.login + '/' + splitPath[0];
    switch (splitPath.length) {
      case 0: // Error
        return Promise.reject('Cannot remove dir with an empty name.');
      case 1: // Remove repo
        return this[callAPI](session, repoPath, null, 'DELETE');
      case 2: // Remove branch
        return this[callAPI](session, repoPath + '/branches', null, 'GET')
        .then((branches) => {
          if(branches.length > 1)
            return this[callAPI](session, repoPath + '/git/refs/heads/' + splitPath[1], null, 'DELETE');
          else {
            const err = new Error('You can not leave this folder empty.');
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

  rmdir(session, path) {
    return this.unlink(session, path);
  }

  batch(session, actions, message) {
    const splitPath = getPathTokens(actions[0].path);
    return this[transformTree](session, splitPath[0], function(treeRes) {
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

  // Internals

  /**
   * Create a branch with the given parameters
   * @param {GHSession} session - GH session
   * @param  {string} repo - Repository name where to create the branch
   * @param  {string} branchName - Name for the newly created branch
   * @param  {string} [fromBranch] - Branch to start the new branch from. Default to the default_branch of the repo
   * @return {Promise} a Promise of the API call result
   */
  [createBranch](session, repo, branchName, fromBranch) {
    if(!session.account || !session.account.login)
      return Promise.reject('User account login is not set. Did you called login()?');
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
   * @param {string} tree[].[content] - Content to put into file. If set, sha will be ignored
   * @param {string} tree[].[sha] - Sha of the object to put in the tree. Will be ignored if content is set
   * @param {string} message - Message of the commit
   * @param  {string} [branch=master] - Branch containing the tree
   * @return {Promise} a Promise of the server response
   *
   * @see https://developer.github.com/v3/git/trees/#create-a-tree
   *
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
   * @see https://developer.github.com/v3/git/trees/#create-a-tree
   */
  [transformTree](session, repo, transformer, message, branch) {
    branch = branch || 'master';
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
        return Promise.reject('You can not leave this folder empty.');
      } else {
        return Promise.reject('Invalid tree transformation. Transformer must return an array.');
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
   * @see https://developer.github.com/v3/git/blobs/#create-a-blob
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
   * @return {Promise|Stream} a Promise of the result send by server or a stream to the endpoint
   */
  [callAPI](session, path, data, method, isStream = false) {

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
  }
}

module.exports = GitHubConnector;
