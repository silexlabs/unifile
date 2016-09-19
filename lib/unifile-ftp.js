'use strict';
/**
 * Service connector for FTP server
 */
const PassThrough = require('stream').PassThrough;

const Promise = require('bluebird');
const Ftp = require('ftp');
const mime = require('mime');

const NAME = 'ftp';

function callAPI(session, action, ...params) {
  return new Promise((resolve, reject) => {
    var client = new Ftp();
    client.on('ready', () => {
      client[action](...params, (err, res) => {
        if(err) return reject(err);
        resolve(res);
        client.end();
      });
    });

    client.on('error', () => {
      client.end();
      reject();
    });

    client.connect(session);
  });
}

class FtpConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'FTP',
      icon: '../assets/ftp.png',
      description: 'Edit files on a web FTP server.',
      isLoggedIn: (session && 'token' in session),
      isOAuth: false,
      username: session.user
    };
  }

  getAuthorizeURL(session) {
    return Promise.resolve(this.config.redirectUri);
  }

  setAccessToken(session, token) {
    session.token = token;
    return Promise.resolve(token);
  }

  /**
   * Log in the FTP server
   * @param {Object} session - the user session
   * @param {Object} loginInfos - Options passed to the connection method
   * @see https://www.npmjs.com/package/ftp#methods
   */
  login(session, loginInfos) {
    return new Promise((resolve, reject) => {
      var client = new Ftp();
      // Successful connection
      client.on('ready', resolve);
      // Error
      client.on('error', reject);

      client.connect(loginInfos);
    })
      .then(() => {
        session.host = loginInfos.host;
        session.port = loginInfos.port;
        session.user = loginInfos.user;
        session.password = loginInfos.password;
        this.setAccessToken(session, loginInfos.user);
      });
  }

  //Filesystem commands

  readdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'list', path)
        .then((list) => {
          return list.reduce((memo, entry) => {
            if(entry.name.charAt(0) != '.')
              memo.push({
                size: entry.size,
                modified: entry.date,
                name: entry.name,
                isDir: entry.type == 'd',
                mime: mime.lookup(entry.name)
              });
            return memo;
          }, []);
        });
    }
  }

  mkdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'mkdir', path);
    }
  }

  writeFile(session, path, data) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'put', data, path);
    }
  }

  createWriteStream(session, path) {
    if(!session.token)
      throw 'User not logged in yet. You need to call the login() first.';

    var through = new PassThrough();
    callAPI(session, 'put', through, path);
    return through;
  }

  readFile(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'get', path)
        .then((fileStream) => {
          return new Promise((resolve, reject) => {
            let content = '';
            fileStream.on('data', (chunk) => content += chunk);
            fileStream.on('finish', () => resolve(content));
            fileStream.on('error', reject);
          });
        });
    }
  }

  createReadStream(session, path) {
    if(!session.token)
      throw 'User not logged in yet. You need to call the login() first.';

    var through = new PassThrough();
    callAPI(session, 'get', path)
      .then((fileStream) => {
        fileStream.pipe(through);
      })
      .catch((err) => {throw err;});

    return through;
  }

  rename(session, src, dest) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'rename', src, dest);
    }
  }

  unlink(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'delete', path);
    }
  }

  rmdir(session, path) {
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else {
      return callAPI(session, 'rmdir', path);
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

module.exports = FtpConnector;
