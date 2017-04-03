'use strict';
/**
 * Service connector for WebDAV server
 */
const Url = require('url');
const request = require('request');
const Promise = require('bluebird');
const XmlStream = require('xml-stream');

const NAME = 'webdav';

const callAPI = Symbol('callAPI');

class WebDavConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'WebDAV',
      icon: '../assets/webdav.png',
      description: 'Edit files on a WebDAV server',
      isLoggedIn: (session && 'token' in session),
      isOAuth: false,
      username: this.session.user || 'Unauthentified'
    };
  }

  getAuthorizeURL(session) {
    return Promise.resolve(this.config.redirectUri);
  }

  setAccessToken(session, token) {
    session.token = token;
    return Promise.resolve(token);
  }

  clearAccessToken(session) {
    session.token = null;
    return Promise.resolve();
  }

  /**
   * Log in the WebDAV server
   * @param {Object} session - the user session
   * @param {Object} loginInfos - Options passed to the connection method
   */
  login(session, loginInfos) {
    if(loginInfos.constructor === String) {
      session.url = Url.parse(loginInfos);
      [session.user, session.password] = session.url.auth.split(':');
    } else {
      session.url = Url.parse(loginInfos.host);
      Object.assign(session, loginInfos);
    }
    return Promise.resolve(this.setAccessToken(session, session.user));
  }

  // Filesystem commands

  readdir(session, path) {
    return this[callAPI](session, path, {}, 'PROPFIND', false, {
      Depth: 1
    })
    .then((list) => {
      return list.reduce((memo, entry, index) => {

        let name = decodeURI(entry['d:href']);
        // Don't return the first element as it's '.'
        if(index == 0) return memo;

        const isDir = name.endsWith('/');
        name = isDir ? name.slice(0, -1) : name;
        name = name.split('/').pop();

        memo.push({
          size: entry['d:propstat']['d:prop']['d:getcontentlength'] || 'n/a',
          modified: new Date(entry['d:propstat']['d:prop']['d:getlastmodified']),
          name: name,
          isDir: isDir,
          mime: isDir ? 'application/directory' : entry['d:propstat']['d:prop']['d:getcontenttype']
        });

        return memo;
      }, []);
    });
  }

  mkdir(session, path) {
    return this[callAPI](session, path, {}, 'MKCOL');
  }

  writeFile(session, path, data) {
    return this[callAPI](session, path, data, 'PUT');
  }

  createWriteStream(session, path) {
    return this[callAPI](session, path, {}, 'PUT', true);
  }

  readFile(session, path) {
    return this[callAPI](session, path, {}, 'GET');
  }

  createReadStream(session, path) {
    return this[callAPI](session, path, {}, 'GET', true);
  }

  rename(session, src, dest) {
    return this[callAPI](session, src, {}, 'MOVE', false, {
      'Destination': session.url.href + dest
    });
  }

  unlink(session, path) {
    return this[callAPI](session, path, {}, 'DELETE');
  }

  rmdir(session, path) {
    return this.unlink(session, path);
  }

  batch(session, actions, message) {
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

  /**
   * Make a call to the WebDAV server
   * @param {Object} session - WebDAV session storage
   * @param {string} path - End point path
   * @param {Object} data - Data to pass. Will be ignored if method is GET
   * @param {string} method - HTTP verb to use
   * @param {boolean} [isStream=false] - Use the API as a stream
   * @param {Object} [headers={}] - Additionals headers to send
   * @return {Promise|Stream} a Promise of the result send by server or a stream to the endpoint
   */
  [callAPI](session, path, data, method, isStream = false, headers = {}) {
    const opts = {
      url: session.url.href + path,
      method: method,
      auth: {
        user: session.user,
        password: session.password
      },
      headers: headers
    };


    if(isStream) return request(opts);
    else {
      if(Object.keys(data).length !== 0) opts.body = data;
      return new Promise((resolve, reject) => {
        const req = request(opts);
        req.on('response', (res) => {
          if(res.statusCode >= 400) {
            const error = new Error(res.statusMessage);
            error.statusCode = res.statusCode;
            res.pipe(process.stdout);
            return reject(error);
          }

          if(res.headers['content-type'].includes('application/xml')) {
            const results = [];
            const resStream = new XmlStream(req);
            resStream.on('endElement: d:response', (item) => {
              results.push(item);
            });
            resStream.on('end', () => {
              return resolve(results);
            });
            resStream.on('error', (err) => {
              return reject(err);
            });
            //resStream.on('data', data => process.stdout.write(data));
          } else {
            const encoding = (res.headers['content-type'].match(/charset=(\S+)/) || ['utf8']).pop();
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              return resolve(Buffer.concat(chunks).toString(encoding));
            });
          }
        });
      });
    }
  }
}

module.exports = WebDavConnector;
