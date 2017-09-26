'use strict';

const Promise = require('bluebird');
const Mime = require('mime');
const Fs = Promise.promisifyAll(require('fs'), {suffix: 'Promised'});
const Path = require('path');

const Tools = require('./tools');

const NAME = 'fs';

const validatePath = Symbol('validatePath');

function statToFileInfos(filename, stat) {
	const isDir = stat.isDirectory();
	return {
		size: stat.size,
		modified: stat.mtime,
		name: filename,
		isDir: isDir,
		mime: isDir ? 'application/directory' : Mime.lookup(filename)
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
   * @param {string} [config.rootPath] - Path against all relative paths will be resolved.
   * Default to the first sandbox path if given or /.
   * @param {boolean} [config.showHiddenFiles=false] - Flag to show hidden files.
   * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
   * @throws {Error} Invalid sandbox path.
   */
	constructor(config) {
		const conf = config || {};
		this.showHiddenFile = conf.showHiddenFile;
		this.infos = Tools.mergeInfos(conf.infos, {
			name: NAME,
			displayName: 'Local',
			icon: '',
			description: 'Edit files on your local drive.'
		});
		this.name = this.infos.name;

		if(!conf.sandbox) this.sandbox = [];
		else if(conf.sandbox.constructor === String) this.sandbox = [conf.sandbox];
		else if(Array.isArray(conf.sandbox)) this.sandbox = conf.sandbox;
		else throw new Error('Invalid sandbox path. Must be a string or an array');

		if(conf.rootPath) this.rootPath = conf.rootPath;
		else if(this.sandbox.length > 0) this.rootPath = this.sandbox[0];
		else this.rootPath = '/';
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
		try {
			const securePath = this[validatePath](path);
			return Fs.readdirPromised(securePath)
			.reduce((memo, entry) => {
				if(this.showHiddenFile || entry.charAt(0) != '.') {
					return Fs.statPromised(Path.resolve(securePath, entry))
					.then((stat) => {
						memo.push(statToFileInfos(entry, stat));
						return memo;
					});
				} else {
					return memo;
				}
			}, []);
		} catch (e) {
			return Promise.reject(e);
		}
	}

	stat(session, path) {
		try {
			const securePath = this[validatePath](path);
			return Fs.statPromised(securePath)
			.then((stat) => {
				return statToFileInfos(Path.basename(securePath), stat);
			});
		} catch (e) {
			return Promise.reject(e);
		}
	}

	mkdir(session, path) {
		try {
			return Fs.mkdirPromised(this[validatePath](path));
		} catch (e) {
			return Promise.reject(e);
		}
	}

	writeFile(session, path, data) {
		try {
			return Fs.writeFilePromised(this[validatePath](path), data);
		} catch (e) {
			return Promise.reject(e);
		}
	}

	createWriteStream(session, path) {
		return Fs.createWriteStream(this[validatePath](path));
	}

	readFile(session, path) {
		try {
			return Fs.readFilePromised(this[validatePath](path));
		} catch (e) {
			return Promise.reject(e);
		}
	}

	createReadStream(session, path) {
		return Fs.createReadStream(this[validatePath](path), {encoding: 'utf8'});
	}

	rename(session, src, dest) {
		try {
			return Fs.renamePromised(this[validatePath](src), this[validatePath](dest));
		} catch (e) {
			return Promise.reject(e);
		}
	}

	unlink(session, path) {
		try {
			return Fs.unlinkPromised(this[validatePath](path));
		} catch (e) {
			return Promise.reject(e);
		}
	}

	rmdir(session, path) {
		try {
			return Fs.rmdirPromised(this[validatePath](path));
		} catch (e) {
			return Promise.reject(e);
		}
	}

	batch(session, actions, message) {
		return Tools.simpleBatch(this, session, actions);
	}

	/**
   * Ensure the given path is in the user-defined sandbox
   * @private
   */
	[validatePath](path) {
		const absolutePath = Path.resolve(this.rootPath, path);
		if(this.sandbox.length !== 0 && !this.sandbox.some((sandboxPath) => absolutePath.startsWith(sandboxPath)))
			throw new Error(`Path is out of the sandbox: ${absolutePath}`);
		return absolutePath;
	}
}

module.exports = FsConnector;
