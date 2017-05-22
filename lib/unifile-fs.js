'use strict';

const Promise = require('bluebird');
const mime = require('mime');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const Path = require('path');

const Tools = require('./tools');

const NAME = 'fs';

function statToFileInfos(filename, stat) {
  const isDir = stat.isDirectory();
  return {
    size: stat.size,
    modified: stat.mtime,
    name: filename,
    isDir: isDir,
    mime: isDir ? 'application/directory' : mime.lookup(filename)
  };
}

/**
 * Service connector for the local filesystem.
 */
class FsConnector {
  /**
   * @constructor
   * @param {Object} config - Configuration object
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   */
  constructor(config) {
    this.config = config;

    this.infos = Tools.mergeInfos(config.infos, {
      name: NAME,
      displayName: 'Local',
      icon: '',
      description: 'Edit files on your local drive.'
    });
    this.name = this.infos.name;
  }

  getInfos(session) {
    return Object.assign({
      isLoggedIn: true,
      isOAuth: false,
      username: process.env.USER
    }, this.infos);
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
    return Fs.readdirPromised(path)
    .reduce((memo, entry) => {
      if(this.config.showHiddenFile || entry.charAt(0) != '.') {
        return Fs.statPromised(Path.resolve(path, entry))
        .then((stat) => {
          memo.push(statToFileInfos(entry, stat));
          return memo;
        });
      } else {
        return memo;
      }
    }, []);
  }

  stat(session, path) {
    return Fs.statPromised(path)
    .then((stat) => {
      return statToFileInfos(Path.basename(path), stat);
    });
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
