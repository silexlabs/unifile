'use strict';
const Url = require('url');
const Path = require('path');

const PassThrough = require('stream').PassThrough;

const Promise = require('bluebird');
const Ftp = require('ftp');
const Mime = require('mime');

const Tools = require('./tools');

const NAME = 'ftp';

function callAPI(session, action, ...params) {
  return new Promise((resolve, reject) => {
    var client = new Ftp();
    client.on('ready', () => {
      client[action](...params, (err, res) => {
        if(err) return reject(err);
        resolve(res);
        // Wait for stream ending before closing
        if(res && res.readable) res.on('end', () => client.end());
      });
    });

    client.on('error', () => {
      client.end();
      reject();
    });

    client.connect(session);
  });
}

function toFileInfos(entry) {
  const isDir = entry.type === 'd';
  return {
    size: entry.size,
    modified: entry.date,
    name: entry.name,
    isDir: isDir,
    mime: isDir ? 'application/directory' : Mime.lookup(entry.name)
  };
}

/**
 * Service connector for {@link https://en.wikipedia.org/wiki/File_Transfer_Protocol|FTP} server
 */
class FtpConnector {
  /**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {string} config.redirectUri - URI of the login page
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   */
  constructor(config) {
    if(!config || !config.redirectUri)
      throw new Error('You should at least set a redirectUri for this connector');

    this.redirectUri = config.redirectUri;
    this.showHiddenFile = config.showHiddenFile || false;
    this.infos = Tools.mergeInfos(config.infos || {}, {
      name: NAME,
      displayName: 'FTP',
      icon: '../assets/ftp.png',
      description: 'Edit files on a web FTP server.'
    });
    this.name = this.infos.name;
  }

  getInfos(session) {
    return Object.assign({
      isLoggedIn: (session && 'token' in session),
      isOAuth: false,
      username: session.user
    }, this.infos);
  }

  getAuthorizeURL(session) {
    return Promise.resolve(this.redirectUri);
  }

  setAccessToken(session, token) {
    session.token = token;
    return Promise.resolve(token);
  }

  clearAccessToken(session) {
    Tools.clearSession(session);
    return Promise.resolve();
  }

  login(session, loginInfos) {
    let ftpConf;
    if(loginInfos.constructor === String) {
      const url = Url.parse(loginInfos);
      const ftpConf = {
        host: url.hostname,
        port: url.port
      };
      [ftpConf.user, ftpConf.password] = url.auth.split(':');
    } else {
      ftpConf = Object.assign({}, loginInfos);
    }

    return new Promise((resolve, reject) => {
      var client = new Ftp();
      // Successful connection
      client.on('ready', resolve);
      // Error
      client.on('error', reject);

      client.connect(ftpConf);
    })
    .then(() => {
      Object.assign(session, ftpConf);
      this.setAccessToken(session, ftpConf.user);
    });
  }

  //Filesystem commands

  readdir(session, path) {
    return callAPI(session, 'list', path)
    .then((list) => {
      return list.reduce((memo, entry) => {
        if(this.showHiddenFile || entry.name.charAt(0) != '.')
          memo.push(toFileInfos(entry));
        return memo;
      }, []);
    });
  }

  stat(session, path) {
    return callAPI(session, 'list', path)
    .then((entries) => {
      // It's a file
      if(entries.length === 1) return toFileInfos(entries[0]);
      // It's a folder
      const folder = entries.find((stat) => stat.name === '.');
      folder.name = Path.basename(path);
      return toFileInfos(folder);
    });
  }

  mkdir(session, path) {
    return callAPI(session, 'mkdir', path);
  }

  writeFile(session, path, data) {
    return callAPI(session, 'put', data, path);
  }

  createWriteStream(session, path) {

    var through = new PassThrough();
    callAPI(session, 'put', through, path);
    return through;
  }

  readFile(session, path) {
    return callAPI(session, 'get', path)
    .then((fileStream) => {
      return new Promise((resolve, reject) => {
        const chunks = [];
        fileStream.on('data', (chunk) => chunks.push(chunk));
        fileStream.on('finish', () => resolve(Buffer.concat(chunks).toString()));
        fileStream.on('error', reject);
      });
    });
  }

  createReadStream(session, path) {

    var through = new PassThrough();
    callAPI(session, 'get', path)
    .then((fileStream) => {
      fileStream.pipe(through);
    })
    .catch((err) => {throw err;});

    return through;
  }

  rename(session, src, dest) {
    return callAPI(session, 'rename', src, dest);
  }

  unlink(session, path) {
    return callAPI(session, 'delete', path);
  }

  rmdir(session, path) {
    return callAPI(session, 'rmdir', path);
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
}

module.exports = FtpConnector;
