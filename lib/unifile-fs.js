'use strict';
/**
 * Service connector for Filesystem
 */
const Promise = require('bluebird');
const mime = require('mime');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const Path = require('path');

const NAME = 'fs';

class FsConnector {
  /**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   */
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'Local',
      icon: '',
      description: 'Edit files on your local drive.',
      isLoggedIn: true,
      isOAuth: false,
      username: ''
    };
  }

  // Auth methods are useless here

  getAuthorizeURL(session) {
    return Promise.resolve('');
  }

  setAccessToken(session, token) {
    return Promise.resolve(token);
  }

  clearAccessToken(session) {
    return Promise.resolve();
  }

  login(session, loginInfos) {
    return new Promise.resolve();
  }

  //Filesystem commands

  readdir(session, path) {
    return Fs.readdirPromised(Path.resolve(path))
    .reduce((memo, entry) => {
      if(this.config.showHiddenFile || entry.charAt(0) != '.') {
        const fullPath = Path.resolve(path, entry);
        return Fs.statPromised(fullPath)
        .then((stats) => {
          //console.log(path, stats, memo);
          memo.push({
            size: stats.size,
            modified: stats.mtime,
            name: entry,
            isDir: stats.isDirectory(),
            mime: mime.lookup(fullPath)
          });
          return memo;
        });
      } else {
        return memo;
      }
    }, []);
  }

  mkdir(session, path) {
    return Fs.mkdirPromised(path);
  }

  writeFile(session, path, data) {
    return Fs.writeFilePromised(path, data);
  }

  createWriteStream(session, path) {
    return Fs.createWriteStream(path);
  }

  readFile(session, path) {
    return Fs.readFilePromised(path);
  }

  createReadStream(session, path) {
    return Fs.createReadStream(path);
  }

  rename(session, src, dest) {
    return Fs.renamePromised(src, dest);
  }

  unlink(session, path) {
    return Fs.unlinkPromised(path);
  }

  rmdir(session, path) {
    return Fs.rmdirPromised(path);
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

module.exports = FsConnector;
