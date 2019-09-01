'use strict';

const PassThrough = require('stream').PassThrough;

const Promise = require('bluebird');
const Ftp = require('basic-ftp');
const Mime = require('mime');

const Tools = require('unifile-common-tools');
const {UnifileError} = require('./error');

const NAME = 'ftp';

/**
 * Initialize a new FTP client
 * @param {Credentials} credentials - Access info for the FTP server
 * @return {Promise<Ftp>} a promise for a FTP client
 */
function getClient(credentials) {
	const ftp = new Ftp.Client();
	return ftp.access(credentials)
	.then(() => ftp);
}

function callAPI(session, action, client, ...params) {
	function execute(ftpClient) {
		// Makes paths in params absolute
		const absParams = params.map((p) => {
			if(p.constructor === String) return '/' + p;
			return p;
		});
		switch (action) {
			case 'ls':
			case 'stat':
				return ftpClient.list(...absParams);
			case 'put':
				return ftpClient.upload(...absParams);
			case 'get':
				return ftpClient.download(...absParams);
			case 'rename':
				return ftpClient.rename(...absParams);
			case 'delete':
				return ftpClient.remove(...absParams);
			case 'rmdir':
				return ftpClient.removeDir(...absParams);
			case 'mkdir':
				return ftpClient.send(`MKD ${absParams[0]}`);
			default:
				throw new UnifileError(UnifileError.ENOTSUP, `Unsupported FTP command ${action}`);
		}
	}

	let ftp = client;
	let promise = null;
	if(ftp) {
		promise = execute(ftp);
	} else {
		promise = getClient(session)
		.then((ftpClient) => {
			ftp = ftpClient;
			return execute(ftp);
		});
	}

	return promise.catch((err) => {
		if(err.code === 530) {
			throw new UnifileError(UnifileError.EACCES, 'Invalid credentials');
		} else if(err.code >= 400 && err.code < 500) {
			throw new UnifileError(UnifileError.ENOENT, 'Not found');
		}
		throw new UnifileError(UnifileError.EIO, err.message);
	})
	.then((result) => {
		// Client was not provided, we can close it
		if(!client && result && !result.readable) {
			ftp.close();
		}
		return result;
	});
}

function toFileInfos(entry) {
	return {
		size: entry.size,
		modified: new Date(entry.date).toISOString(),
		name: entry.name.split('/').pop(),
		isDir: entry.isDirectory,
		mime: entry.isDirectory ? 'application/directory' : Mime.getType(entry.name)
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
		const ftpConf = {};
		try {
			Object.assign(ftpConf, Tools.parseBasicAuth(loginInfos));
			ftpConf.pass = ftpConf.password;
		} catch (e) {
			return Promise.reject(e);
		}

		const client = new Ftp.Client();
		return client.access(ftpConf)
		.catch((err) => {
			if(err.code === 'ETIMEDOUT')
				throw new UnifileError(UnifileError.EIO, 'Unable to reach server');
			else
				throw new UnifileError(UnifileError.EACCES, 'Invalid credentials');
		})
		.then(() => {
			Object.assign(session, ftpConf);
			this.setAccessToken(session, ftpConf.user);
		});
	}

	//Filesystem commands

	readdir(session, path, ftpSession) {
		return callAPI(session, 'ls', ftpSession, path)
		.then((list) => {
			return list.reduce((memo, entry) => {
				if(this.showHiddenFile || entry.name.charAt(0) != '.')
					memo.push(toFileInfos(entry));
				return memo;
			}, []);
		});
	}

	stat(session, path, ftpSession) {
		return callAPI(session, 'stat', ftpSession, path)
		.then((result) => {
			if(result.length > 1)
			// It's a folder
			  return {
					size: 4096,
					modified: new Date(Math.min(...result.map((entry) => new Date(entry.date).getTime()))).toISOString(),
					name: path,
					isDir: true,
					mime: 'application/directory'
				};
			else return toFileInfos(result[0]);
		});
	}

	mkdir(session, path, ftpSession) {
		return callAPI(session, 'mkdir', ftpSession, path);
	}

	writeFile(session, path, data, ftpSession) {
		const stream = new PassThrough();
		stream.end(data);
		return callAPI(session, 'put', ftpSession, stream, path);
	}

	createWriteStream(session, path, ftpSession) {
		var through = new PassThrough();
		callAPI(session, 'put', ftpSession, through, path);
		return through;
	}

	readFile(session, path, ftpSession) {
		var fileStream = new PassThrough();
		return callAPI(session, 'get', ftpSession, fileStream, path)
		.then(() => {
			return new Promise((resolve, reject) => {
				const chunks = [];
				fileStream.on('data', (chunk) => chunks.push(chunk));
				fileStream.on('end', () => resolve(Buffer.concat(chunks)));
				fileStream.on('error', (err) => {
					reject(err);
				});
			});
		});
	}

	createReadStream(session, path, ftpSession) {
		var through = new PassThrough();
		callAPI(session, 'get', ftpSession, through, path)
		.catch((err) => through.emit('error', err));
		return through;
	}

	rename(session, src, dest, ftpSession) {
		return callAPI(session, 'rename', ftpSession, src, dest);
	}

	unlink(session, path, ftpSession) {
		return callAPI(session, 'delete', ftpSession, path);
	}

	rmdir(session, path, ftpSession) {
		return callAPI(session, 'rmdir', ftpSession, path);
	}

	batch(session, actions, message) {
		let ftpClient;
		return getClient(session)
		.then((ftp) => {
			ftpClient = ftp;
			return Promise.each(actions, (action) => {
				const act = action.name.toLowerCase();
				switch (act) {
					case 'unlink':
					case 'rmdir':
					case 'mkdir':
						return this[act](session, action.path, ftpClient);
					case 'rename':
						return this[act](session, action.path, action.destination, ftpClient);
					case 'writefile':
						return this.writeFile(session, action.path, action.content, ftpClient);
					default:
						console.warn(`Unsupported batch action: ${action.name}`);
				}
			});
		});
	}
}

module.exports = FtpConnector;
