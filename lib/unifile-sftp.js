'use strict';
/**
 * Service connector for SFTP
 */
const Mime = require('mime');
const Promise = require('bluebird');
const PassThrough = require('stream').PassThrough;
const SFTPClient = require('sftp-promises');

const NAME = 'sftp';

function assertSuccess(success, errorMessage) {
  return success ? Promise.resolve() : Promise.reject(new Error(errorMessage));
}

class SftpConnector {
  /**
   * @constructor
   * @param {Object} config - Configuration object.
   * @param {string} config.redirectUri - URI redirecting to an authantification form.
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   */
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'SFTP',
      icon: '',
      description: 'Edit files on a SSH server.',
      isLoggedIn: 'token' in session,
      isOAuth: false,
      username: session.username
    };
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

  mkdir(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.mkdir(path, sftpSession)
    .then((success) => {
      assertSuccess(success, 'Unable to create remote dir. Does it already exist?');
    });
  }

  writeFile(session, path, data, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.putBuffer(new Buffer(data), path, sftpSession)
    .then((success) => assertSuccess(success, 'Unable to create remote file'));
  }

  createWriteStream(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    const stream = new PassThrough();
    sftp.putStream(path, stream, sftpSession)
    .then((success) => {
      if(!success) stream.emit('error', new Error('Unable to create write stream'));
    });
    return stream;
  }

  readFile(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.getBuffer(path)
    .then((buffer) => {
      if(!buffer) return Promise.reject('Unable to read remote file');
      return buffer.toString();
    });
  }

  createReadStream(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    const stream = new PassThrough();
    sftp.getStream(path, stream, sftpSession)
    .then((success) => {
      if(!success) stream.emit('error', new Error('Unable to create read stream'));
    });
    return stream;
  }

  rename(session, src, dest, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.mv(src, dest, sftpSession)
    .then((success) => assertSuccess(success, 'Unable to rename this path'));
  }

  unlink(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.rm(path, sftpSession)
    .then((success) => assertSuccess(success, 'Unable to remove file'));
  }

  rmdir(session, path, sftpSession) {
    const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
    return sftp.rmdir(path, sftpSession)
    .then((success) => assertSuccess(success, 'Unable to remove directory. Is is empty?'));
  }

  batch(session, actions, message) {
    const sftp = new SFTPClient();
    return sftp.session(session)
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
