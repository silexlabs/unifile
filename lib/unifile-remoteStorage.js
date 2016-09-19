'use strict';

const Promise = require('bluebird');
const WebFinger = require('webfinger.js');
const request = require('request');
const mime = require('mime');

const NAME = 'remotestorage';

function get(url, path, token) {
  const opts = {
    url: url + '/' + path,
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };
  return new Promise(function(resolve, reject) {
    request.get(opts, function(err, res, body) {
      resolve(body);
    });
  });
}

function put(url, path, content, token) {
  const opts = {
    url: url + '/' + path,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'text/plain; charset=UTF-8'
    },
    body: content
  };
  return new Promise(function(resolve, reject) {
    request.put(opts, function(err, res, body) {
      resolve(body);
    });
  });
}

function del(url, path, token) {
  const opts = {
    url: url + '/' + path,
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };
  return new Promise(function(resolve, reject) {
    request.del(opts, function(err, res, body) {
      resolve(body);
    });
  });
}

class RemoteStorageConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'FTP',
      icon: '../assets/rs.png',
      description: 'Edit files on a RemoteStorage service',
      isLoggedIn: (session && 'token' in session),
      isOAuth: true,
      username: this.config.userAddress
    };
  }

  getAuthorizeURL(session) {
    return new Promise((resolve, reject) => {
      new WebFinger().lookup(session.userAddress, (err, res) => {
        if(err)
          reject(err);
        else {
          const infos = res.object.links[0];
          session.infos = {
            href: infos.href,
            storageType: infos.properties['http://remotestorage.io/spec/version'],
            authURL: infos.properties['http://tools.ietf.org/html/rfc6749#section-4.2'],
            properties: infos.properties
          };
          let query = 'redirect_uri=' + this.config.redirectUri
          + '&client_id=Unifile'
          + '&scope=*:rw'
          + '&response_type=token';
          if(session.infos.authURL.indexOf('?') > -1) query = '&' + query;
          else query = '?' + query;

          resolve(session.infos.authURL + query);
        }
      });
    });
  }

  login(session, loginInfos) {
    session.token = loginInfos.token;
    return Promise.resolve(session.token);
  }

  readdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(!path.endsWith('/')) {
      return Promise.reject('Folder path must end with a /.'
        + 'If you want to see a file content, call readFile() instead');
    } else {
      return get(session.infos.href, path, session.token)
        .then((result) => {
          var obj = JSON.parse(result);
          console.log('result', obj);
          return Object.keys(obj.items).map((key) => {
            return {
              size: obj.items[key]['Content-Length'] || 'N/A',
              modified: 'N/A',
              name: key,
              isDir: key.endsWith('/'),
              mime: mime.lookup(key)
            };
          });
        });
    }
  }

  mkdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(!path.endsWith('/')) {
      return Promise.reject('Folder path must end with a /. If you want to create a file, call writeFile() instead');
    } else {
      return put(session.infos.href, path + '/.keep', '', session.token);
    }
  }

  writeFile(session, path, content) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(path.endsWith('/')) {
      return Promise.reject('File path cannot end with a /. If you want to create a folder, call mkdir() instead');
    } else {
      return put(session.infos.href, path, content, session.token);
    }
  }

  readFile(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(path.endsWith('/')) {
      return Promise.reject('File path cannot end with a /.'
        + 'If you want to see a folder listing, call readdir() instead');
    } else {
      return get(session.infos.href, path, session.token);
    }
  }

  rename(session, src, dest) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    let originContent;
    return get(session.infos.href, src, session.token)
    .then((content) => originContent = content)
    .then(() => del(session.infos.href, src, session.token))
    .then(() => put(session.infos.href, dest, originContent, session.token));
  }

  unlink(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(path.endsWith('/')) {
      return Promise.reject('File path cannot end with a /. If you want to delete a folder, call rmdir() instead');
    } else {
      return del(session.infos.href, path, session.token);
    }
  }

  rmdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(!path.endsWith('/')) {
      return Promise.reject('Folder path must end with a /. If you want to delete a file, call unlink() instead');
    } else {
      return del(session.infos.href, path + '/.keep', session.token);
    }
  }

  batch(session, actions, message) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    return Promise.each(actions, (action) => {
      const act = action.name.toLowerCase();
      switch (act) {
        case 'unlink':
        case 'rmdir':
        case 'mkdir':
          this[act](session, action.path);
          break;
        case 'rename':
          this[act](session, action.path, action.destination);
          break;
        case 'writefile':
          this.writeFile(session, action.path, action.content);
          break;
        default:
          console.warn(`Unsupported batch action: ${action.name}`);
      }
    });
  }
}

module.exports = RemoteStorageConnector;
