'use strict';

const Mime = require('mime');
const Promise = require('bluebird');
const {PassThrough} = require('stream');
const SFTPClient = require('sftp-promises');
const {Client} = require('ssh2');

const Tools = require('./tools');

const NAME = 'sftp';

function parseError(err) {
	let msg = null;
	switch (err.code) {
		case 2:
			msg = 'This path does not exist';
			break;
		case 4:
			msg = 'An error occured: ' + err;
			break;
		default:
			throw err;
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
		if(!config || !config.redirectUri)
			throw new Error('You should at least set a redirectUri for this connector');

		this.redirectUri = config.redirectUri;
		this.showHiddenFile = config.showHiddenFile || false;
		this.infos = Tools.mergeInfos(config.infos || {}, {
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
		try {
			const auth = Tools.parseBasicAuth(loginInfos);
			session.host = auth.host;
			session.port = auth.port;
			session.user = auth.user;
			// Duplicate because SFTP wait for `username` but we want to keep compatibility
			session.username = auth.user;
			session.password = auth.password;
		} catch (e) {
			return Promise.reject(e);
		}
		// Check credentials by stating root
		return this.stat(session, '/')
		.catch((err) => {
			throw new Error('Cannot access server. Please check your credentials. ' + err);
		})
		.then(() => Promise.resolve(this.setAccessToken(session, session.username)));
	}

	//Filesystem commands
	// An additional sftpSession is added to signature to support batch actions

	readdir(session, path, sftpSession) {
		const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
		return sftp.ls(path, sftpSession)
		.catch(parseError)
		.then((directory) => {
			if(!directory.entries) return Promise.reject('Target is not a directory');
			return directory.entries.reduce((memo, entry) => {
				if(this.showHiddenFile || !entry.filename.startsWith('.')) {
					const isDir = entry.longname.startsWith('d');
					memo.push({
						size: entry.attrs.size,
						modified: entry.attrs.mtime,
						name: entry.filename,
						isDir: isDir,
						mime: isDir ? 'application/directory' : Mime.lookup(entry.filename)
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
		});
	}

	writeFile(session, path, data, sftpSession) {
		const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
		return sftp.putBuffer(new Buffer(data), path, sftpSession)
		.catch(parseError)
		.catch((err) => {
			if(err.code === 4) throw new Error('Unable to create remote file. Does its parent exist?');
			else throw err;
		});
	}

	createWriteStream(session, path, sftpSession) {
		const stream = new PassThrough();
		// Get stream for ssh2 directly
		if(sftpSession) {
			sftpSession.sftp((err, sftp) => {
				const sStream = sftp.createWriteStream(path)
				.on('close', () => {
					stream.emit('close');
				});

				stream.pipe(sStream);
			});
		} else {
			const connection = new Client();
			connection.on('ready', function() {
				connection.sftp((err, sftp) => {
					const sStream = sftp.createWriteStream(path)
					.on('close', () => {
						stream.emit('close');
						connection.end();
						connection.destroy();
					});

					stream.pipe(sStream);
				});
			});
			connection.on('error', function(err) {
				stream.emit('error', err);
			});

			connection.connect(session);
		}

		return stream;
	}

	readFile(session, path, sftpSession) {
		const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
		return sftp.getBuffer(path, sftpSession)
		.catch(parseError)
		.then((buffer) => buffer);
	}

	createReadStream(session, path, sftpSession) {
		const stream = new PassThrough();
		// Get stream for ssh2 directly
		if(sftpSession) {
			sftpSession.sftp((err, sftp) => sftp.createReadStream(path).pipe(stream));
		} else {
			const connection = new Client();
			connection.on('ready', function() {
				connection.sftp((err, sftp) => {
					const sStream = sftp.createReadStream(path)
					.on('close', () => {
						stream.emit('close');
						connection.end();
						connection.destroy();
					})
					.on('error', (err) => stream.emit('error', err));

					sStream.pipe(stream);
				});
			});
			connection.on('error', function(err) {
				stream.emit('error', err);
			});

			connection.connect(session);
		}

		return stream;
	}

	rename(session, src, dest, sftpSession) {
		const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
		return sftp.mv(src, dest, sftpSession)
		.catch(parseError);
	}

	unlink(session, path, sftpSession) {
		const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
		return sftp.rm(path, sftpSession)
		.catch(parseError);
	}

	rmdir(session, path, sftpSession) {
		const sftp = sftpSession ? new SFTPClient() : new SFTPClient(session);
		return sftp.rmdir(path, sftpSession)
		.catch(parseError);
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
						return this[act](session, action.path, sftpSession);
					case 'rename':
						return this[act](session, action.path, action.destination, sftpSession);
					case 'writefile':
						return this.writeFile(session, action.path, action.content, sftpSession);
					default:
						console.warn(`Unsupported batch action: ${action.name}`);
				}
			})
			// Close socket
			.then(() => sftpSession.end());
		});
	}
}

module.exports = SftpConnector;
