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
 * @return {Promise} a Promise of the result send by server
 */
function callAPI(session, path, data) {
  let authorization;
  if(session.basic) authorization = 'Basic ' + session.basic;
  else authorization = 'Bearer ' + session.token;

  const reqOptions = {
    url: 'https://api.dropboxapi.com/2' + path,
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json',
      'User-Agent': 'Unifile'
    },
    body: JSON.stringify(data)
  };

  //console.log('Calling', reqOptions.url, 'with', data, '/ auth:', authorization);
  return new Promise(function(resolve, reject) {
    request(reqOptions, function(err, res, body) {
      if(err) {
        return reject(err);
      }
      if(res.statusCode >= 400) {
        console.error(body);
        return reject({statusCode: res.statusCode, message: body});
      }
      try {
        const result = res.statusCode !== 204 ? JSON.parse(body) : null;
        // TODO Paginate
        /*if(res.headers.hasOwnProperty('link')) {
          paginate(reqOptions, res.headers.link, result).then(resolve);
        }
        else*/ resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
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
        path: path,
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
        path: path
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
      return new Promise((resolve, reject) => {
        request({
          url: 'https://content.dropboxapi.com/2/files/upload',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + session.token,
            'Content-Type': 'application/octet-stream',
            'User-Agent': 'Unifile',
            'Dropbox-API-Arg': JSON.stringify({
              path: path
            })
          },
          body: data
        }, function(err, response, body) {
          if(err) return reject('Error while calling Dropbox API. ' + err);
          resolve(body);
        });
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
          path: path
        })
      }
    });
  }

  readFile(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return new Promise((resolve, reject) => {
        request({
          url: 'https://content.dropboxapi.com/2/files/download',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + session.token,
            'User-Agent': 'Unifile',
            'Dropbox-API-Arg': JSON.stringify({
              path: path
            })
          }
        }, function(err, response, body) {
          if(err) return reject('Error while calling Dropbox API. ' + err);
          resolve(body);
        });
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
          path: path
        })
      }
    });
  }

  rename(session, src, dest) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/move', {
        from_path: src,
        to_path: dest
      });
    }
  }

  unlink(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, '/files/delete', {
        path: path
      });
    }
  }

  rmdir(session, path) {
    return this.unlink(session, path);
  }
}

module.exports = DropboxConnector;
