'use strict';

const Promise = require('bluebird');
const mime = require('mime');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const Path = require('path');
const Os = require('os');

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
   * @param {string|Array<string>} [config.sandbox] - Restrict connector access to this path (if string)
   * or these paths (if array)
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   * @throws {Error} Invalid sandbox path.
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

    if(!config.sandbox) this.sandbox = [];
    else if(config.sandbox.constructor === String) this.sandbox = [config.sandbox];
    else if(Array.isArray(config.sandbox)) this.sandbox = config.sandbox;
    else throw new Error('Invalid sandbox path. Must be a string or an array');
  }

  resolvePath(path) {
    // is the path alreay resolved
    if(path.startsWith(Os.homedir()) && Path.resolve(path).startsWith(Os.homedir()))
      return path;
    // or we resolve it in the user ~
    const secure = Path.resolve(Os.homedir(), path);
    // check that it is still in the ~ folder
    if(secure.startsWith(Os.homedir()))
      return secure;
    // there was probably a '..' in the path
    throw 'unsecure path ' + path;
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
    const securePath = this.resolvePath(path);
    return Fs.readdirPromised(securePath)
    .reduce((memo, entry) => {
      if(this.config.showHiddenFile || entry.charAt(0) != '.') {
        return Fs.statPromised(Path.resolve(securePath, entry))
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
    const securePath = this.resolvePath(path);
    return Fs.statPromised(securePath)
    .then((stat) => {
      return statToFileInfos(Path.basename(securePath), stat);
    });
  }

  mkdir(session, path) {
    const securePath = this.resolvePath(path);
    return Fs.mkdirPromised(securePath);
  }

  writeFile(session, path, data) {
    const securePath = this.resolvePath(path);
    return Fs.writeFilePromised(securePath, data);
  }

  createWriteStream(session, path) {
    const securePath = this.resolvePath(path);
    return Fs.createWriteStream(securePath);
  }

  readFile(session, path) {
    const securePath = this.resolvePath(path);
    return Fs.readFilePromised(securePath);
  }

  createReadStream(session, path) {
    const securePath = this.resolvePath(path);
    return Fs.createReadStream(securePath);
  }

  rename(session, src, dest) {
    const secureSrc = this.resolvePath(src);
    const secureDest = this.resolvePath(dest);
    return Fs.renamePromised(secureSrc, secureDest);
  }

  unlink(session, path) {
    const securePath = this.resolvePath(path);
    return Fs.unlinkPromised(securePath);
  }

  rmdir(session, path) {
    const securePath = this.resolvePath(path);
    return Fs.rmdirPromised(securePath);
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
