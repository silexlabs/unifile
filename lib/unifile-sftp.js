'use strict';

const Mime = require('mime');
const Promise = require('bluebird');
const PassThrough = require('stream').PassThrough;
const SFTPClient = require('sftp-promises');

const Tools = require('./tools');

const NAME = 'sftp';

function assertSuccess(success, errorMessage) {
  return success ? Promise.resolve() : Promise.reject(new Error(errorMessage));
}

function parseError(err) {
  let msg = null;
  switch (err.code) {
    case 2:
      msg = 'This path does not exist';
      break;
    case 4:
      msg = 'An error occured: ' + err;
      break;
  }
  const error = new Error(msg);
  error.code = err.code;
  throw error;
}

/**
 * Service connector for {@link https://en.wikipedia.org/wiki/SSH_File_Transfer_Protocol|SFTP}
 */
class SftpConnector {
  /**
   * @constructor
   * @param {Object} config - Configuration object.
   * @param {string} config.redirectUri - URI redirecting to an authantification form.
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   */
  constructor(config) {
    this.config = config;
    this.infos = Tools.mergeInfos(config.infos, {
      name: NAME,
      displayName: 'SFTP',
      icon: '',
      description: 'Edit files on a SSH server.'
    });
    this.name = this.infos.name;
  }

  getInfos(session) {
    return Object.assign({
      isLoggedIn: 'token' in session,
      isOAuth: false,
      username: session.username
    }, this.infos);
  }

  // Auth methods are useless here

  getAuthorizeURL(session) {
    return Promise.resolve(this.config.redirectUri);
  }

  setAccessToken(session, token) {
    // TODO Authorize to set credentials here?
    return Promise.resolve(token);
  }

  clearAccessToken(session) {
    session = {};
    return Promise.resolve();
  }

  login(session, loginInfos) {
    session.host = loginInfos.host;
    session.username = loginInfos.user;
    session.password = loginInfos.password;
    // Will signal Unifile the user is logged in
    session.token = loginInfos.user;
    return Promise.resolve();
  }

  //Filesystem commands
  // An additional sftpSession is added to signature to support batch actions

  readdir(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.ls(path, sftpSession)
    .catch(parseError)
    .then((directory) => {
      if(!directory) return Promise.reject('Unable to list remote dir');
      return directory.entries.reduce((memo, entry) => {
        if(this.config.showHiddenFile || !entry.filename.startsWith('.')) {
          memo.push({
            size: entry.attrs.size,
            modified: entry.attrs.mtime,
            name: entry.filename,
            isDir: entry.longname.startsWith('d'),
            mime: Mime.lookup(entry.filename)
          });
        }
        return memo;
      }, []);
    });
  }

  stat(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.stat(path, sftpSession)
    .catch(parseError)
    .then((entry) => {
      console.log('Entry', entry);
      const filename = entry.path.split('/').pop();
      const isDir = entry.type === 'directory';
      return {
        size: entry.size,
        modified: entry.mtime,
        name: filename,
        isDir: isDir,
        mime: isDir ? 'application/directory' : Mime.lookup(filename)
      };
    });
  }

  mkdir(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.mkdir(path, sftpSession)
    .catch(parseError)
    .catch((err) => {
      if(err.code === 4) throw new Error('Unable to create remote dir. Does it already exist?');
      else throw err;
    })
    .then((success) => {
      assertSuccess(success, 'Unable to create remote dir. Does it already exist?');
    });
  }

  writeFile(session, path, data, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.putBuffer(new Buffer(data), path, sftpSession)
    .catch(parseError)
    .catch((err) => {
      if(err.code === 4) throw new Error('Unable to create remote file. Does it already exist?');
      else throw err;
    })
    .then((success) => assertSuccess(success, 'Unable to create remote file'));
  }

  createWriteStream(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    const stream = new PassThrough();
    sftp.putStream(path, stream, sftpSession)
    .catch(parseError)
    .then((success) => {
      if(!success) stream.emit('error', new Error('Unable to create write stream'));
    });
    return stream;
  }

  readFile(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.getBuffer(path)
    .catch(parseError)
    .then((buffer) => {
      if(!buffer) return Promise.reject('Unable to read remote file');
      return buffer.toString();
    });
  }

  createReadStream(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    const stream = new PassThrough();
    sftp.getStream(path, stream, sftpSession)
    .catch(parseError)
    .then((success) => {
      if(!success) stream.emit('error', new Error('Unable to create read stream'));
    });
    return stream;
  }

  rename(session, src, dest, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.mv(src, dest, sftpSession)
    .catch(parseError)
    .then((success) => assertSuccess(success, 'Unable to rename this path'));
  }

  unlink(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.rm(path, sftpSession)
    .catch(parseError)
    .then((success) => assertSuccess(success, 'Unable to remove file'));
  }

  rmdir(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.rmdir(path, sftpSession)
    .catch(parseError)
    .catch((err) => {
      if(err.code === 4) throw new Error('Unable to remove directory. Is is empty?');
      else throw err;
    })
    .then((success) => assertSuccess(success, 'Unable to remove directory. Is is empty?'));
  }

  batch(session, actions, message) {
    const sftp = new SFTPClient();
    return sftp.session(session)
    .catch(parseError)
    .then((sftpSession) => {
      return Promise.each(actions, (action) => {
        const act = action.name.toLowerCase();
        switch (act) {
          case 'unlink':
          case 'rmdir':
          case 'mkdir':
            this[act](session, action.path, sftpSession);
            break;
          case 'rename':
            this[act](session, action.path, action.destination, sftpSession);
            break;
          case 'writefile':
            this.writeFile(session, action.path, action.content, sftpSession);
            break;
          default:
            console.warn(`Unsupported batch action: ${action.name}`);
        }
      });
    });
  }
}

module.exports = SftpConnector;
