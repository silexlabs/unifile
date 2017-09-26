'use strict';
const Path = require('path');

const PassThrough = require('stream').PassThrough;

const Promise = require('bluebird');
const Ftp = require('ftp');
const Mime = require('mime');

const Tools = require('./tools');

const NAME = 'ftp';

/**
 * Initialize a new FTP client
 * @param {Credentials} credentials - Access info for the FTP server
 * @return {Promise<Ftp>} a promise for a FTP client
 */
function getClient(credentials) {
	return new Promise((resolve, reject) => {
		const ftp = new Ftp();
		ftp.on('ready', () => {
			resolve(ftp);
		});
		ftp.on('error', (err) => {
			reject(err);
			ftp.end();
		});

		ftp.connect(credentials);
	});
}

function callAPI(session, action, client, ...params) {
	function execute(resolve, reject, ftpClient) {
		ftpClient[action](...params, (err, res) => {
			if(err) reject(err);
			else resolve(res);
		});
	}

	let ftp = client;
	return new Promise((resolve, reject) => {
		if(client) {
			execute(resolve, reject, client);
		} else {
			getClient(session)
			.then((client) => {
				ftp = client;
				execute(resolve, reject, ftp);
			})
			.catch((err) => {
				reject(err);
			});
		}
	})
	.then((result) => {
		// Client was not provided, we can close it
		if(!client && result && !result.readable) {
			ftp.end();
		}
		return result;
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
		const ftpConf = {};
		try {
			Object.assign(ftpConf, Tools.parseBasicAuth(loginInfos));
		} catch (e) {
			return Promise.reject(e);
		}

		return new Promise((resolve, reject) => {
			const client = new Ftp();
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

	readdir(session, path, ftpSession) {
		return callAPI(session, 'list', ftpSession, path)
		.then((list) => {
			return list.reduce((memo, entry) => {
				if(this.showHiddenFile || entry.name.charAt(0) != '.')
					memo.push(toFileInfos(entry));
				return memo;
			}, []);
		});
	}

	stat(session, path, ftpSession) {
		return callAPI(session, 'list', ftpSession, path)
		.then((entries) => {
			// It's a file
			if(entries.length === 1) return toFileInfos(entries[0]);
			// It's a folder
			const folder = entries.find((stat) => stat.name === '.');
			folder.name = Path.basename(path);
			return toFileInfos(folder);
		});
	}

	mkdir(session, path, ftpSession) {
		return callAPI(session, 'mkdir', ftpSession, path);
	}

	writeFile(session, path, data, ftpSession) {
		return callAPI(session, 'put', ftpSession, data, path);
	}

	createWriteStream(session, path, ftpSession) {
		var through = new PassThrough();
		callAPI(session, 'put', ftpSession, through, path);
		return through;
	}

	readFile(session, path, ftpSession) {
		const promise = ftpSession ? Promise.resolve(ftpSession) : getClient(session);
		return promise.then((client) => {
			return callAPI(session, 'get', client, path)
			.then((fileStream) => {
				return new Promise((resolve, reject) => {
					const chunks = [];
					fileStream.on('data', (chunk) => chunks.push(chunk));
					fileStream.on('end', () => resolve(Buffer.concat(chunks)));
					fileStream.once('close', () => client.end());
					fileStream.on('error', (err) => {
						client.end();
						reject(err);
					});
				});
			});
		});
	}

	createReadStream(session, path, ftpSession) {
		var through = new PassThrough();
		callAPI(session, 'get', ftpSession, path)
		.then((fileStream) => fileStream.pipe(through))
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
			})
			.finally(() => ftpClient.end());
		});
	}
}

module.exports = FtpConnector;
