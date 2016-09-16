'use strict';
/**
 * Service connector for the dropbox api
 */

const Promise = require('bluebird');
const request = require('request');
const mime = require('mime');

const NAME = 'dropbox';
const DB_OAUTH_URL = 'https://www.dropbox.com/oauth2';

/**
 * Make a call to the Dropbox API
 * @param {Object} session - Dropbox session storage
 * @param {string} path - End point path
 * @param {Object} data - Data to pass. Convert to querystring if method is GET or to the request body
 * @param {string} [subdomain=api] - Subdomain of the endpoint to call (api/content)
 * @param {boolean} [isJson=true] - Whether to stringify the body or not
 * @param {Object} [headers={}] - Override of addition to the request headers
 * @return {Promise} a Promise of the result send by server
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
    body: data,
    json: isJson
  };

  if(headers) {
    for(const header in headers) {
      reqOptions.headers[header] = headers[header];
    }
  }

  //console.log('Calling', reqOptions.url, 'with', reqOptions.body, '/ auth:', authorization);
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
 */
function closeUploadBatchSession(session, entries) {
  return callAPI(session, '/files/upload_session/finish_batch', {
    entries: entries
  });
}

function checkBatchEnd(session, result, checkRoute, jobId) {
  switch (result['.tag']) {
    case 'async_job_id':
      jobId = result.async_job_id;
      // falls through
    case 'in_progress':
      return callAPI(session, checkRoute, {
        async_job_id: jobId
      })
      .then((result) => checkBatchEnd(session, result, checkRoute, jobId));
    case 'complete':
      return Promise.resolve();
  }
}

function makePathAbsolute(path) {
  if(path[0] !== '/') return '/' + path;
  else return path;
}

class DropboxConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'Dropbox',
      icon: '../assets/dropbox.png',
      description: 'Edit html files from your Dropbox.',
      isLoggedIn: (session && 'token' in session),
      isOAuth: true,
      username: session.account.name.display_name
    };
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

  getAuthorizeURL(session) {
    return Promise.resolve(DB_OAUTH_URL +
      '/authorize?response_type=code&client_id=' + this.config.clientId +
        '&redirect_uri=' + this.config.redirectUri +
        '&state=' + this.config.state);
  }

  login(session, loginInfos) {
    if(loginInfos.state !== this.config.state) return Promise.reject('Invalid request (cross-site request)');

    return new Promise((resolve, reject) => {
      request({
        url: 'https://api.dropboxapi.com/oauth2/token',
        method: 'POST',
        form: {
          code: loginInfos.code,
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri
        },
        json: true
      }, function(err, response, body) {
        if(err) return reject('Error while calling Dropbox API. ' + err);
        session.account = {id: body.account_id};
        return resolve(body.access_token);
      });
    })
      .then((token) => {
        return this.setAccessToken(session, token);
      });
  }

  //Filesystem commands

  readdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/list_folder', {
        path: makePathAbsolute(path),
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false
      })
        .then((result) => {
          return result.entries.map((entry) => {
            return {
              size: entry.size,
              modified: entry.client_modified,
              name: entry.name,
              isDir: entry['.tag'] == 'folder',
              mime: mime.lookup(entry.name)
            };
          });
        });
    }
  }

  mkdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/create_folder', {
        path: makePathAbsolute(path)
      });
    }
  }

  writeFile(session, path, data) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
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
  }

  createWriteStream(session, path) {
    if(!session.token)
      throw 'User not logged in yet. You need to call the login() first.';

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
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/download', {}, 'content', false, {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: makePathAbsolute(path)
        })
      });
    }
  }

  createReadStream(session, path) {
    if(!session.token)
      throw 'User not logged in yet. You need to call the login() first.';

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
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/move', {
        from_path: makePathAbsolute(src),
        to_path: makePathAbsolute(dest)
      });
    }
  }

  unlink(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/delete', {
        path: makePathAbsolute(path)
      });
    }
  }

  rmdir(session, path) {
    return this.unlink(session, path);
  }

  batch(session, actions, message) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      const entries = sortBatchActions(session, actions);
      const promises = [];

      if(entries.deleteEntries.length > 0) {
        promises.push(
          callAPI(session, '/files/delete_batch', {
            entries: entries.deleteEntries
          })
          .then((result) => checkBatchEnd(session, result, '/files/delete_batch/check'))
        );
      }
      if(entries.moveEntries.length > 0) {
        promises.push(
          callAPI(session, '/files/move_batch', {
            entries: entries.moveEntries
          })
          .then((result) => checkBatchEnd(session, result, '/files/move_batch/check'))
        );
      }
      if(entries.uploadEntries.length > 0) {
        promises.push(
          Promise.map(entries.uploadEntries, (action) => {
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
          .then((result) => checkBatchEnd(session, result, '/files/upload_session/finish_batch/check'))
        );
      }
      return Promise.all(promises.concat(entries.promises));
    }
  }
}

function sortBatchActions(session, actions) {
  const uploadEntries = [];
  const deleteEntries = [];
  const moveEntries = [];
  const promises = [];
  for(const action of actions) {
    switch (action.name.toLowerCase()) {
      case 'unlink':
      case 'rmdir':
        deleteEntries.push({
          path: makePathAbsolute(action.path)
        });
        break;
      case 'rename':
        if(!action.destination)
          return Promise.reject('Rename action must have a `destination` field');
        moveEntries.push({
          from_path: makePathAbsolute(action.path),
          to_path: makePathAbsolute(action.destination)
        });
        break;
      case 'writefile':
        uploadEntries.push(action);
        break;
      case 'mkdir':
        promises.push(this.mkdir(session, action.path));
        break;
      default:
        console.warn(`Unsupported batch action: ${action.name}`);
    }
  }
  return {
    deleteEntries: deleteEntries,
    uploadEntries: uploadEntries,
    moveEntries: moveEntries,
    promises: promises
  };
}

module.exports = DropboxConnector;
