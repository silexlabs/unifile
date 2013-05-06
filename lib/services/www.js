/**
 * Service connector for the local drive
 * This only serves files as a webserver for now
 */

// config
var config  = require("../config").www;

pathModule = require('path');

/**
 * init the service global vars
 */
exports.init = function (app, express) {
}

/**
 * Connect to the service, i.e. ask for a request token.
 * The request token is required so that the user can allow our app to access his data.
 * Regenerate an auth link each time in order to avoid the expiration 
 * Call the provided callback with these parameters
 *		status			: {"success": true},
 *		authorize_url	: "https://www.dropbox.com/1/oauth/authorize?oauth_token=NMCS862sIG1P5m6P"
 */
exports.connect = function (request, cbk) {
	cbk(
		{success:false, message: 'not implemented yet'}, 
		undefined
	);
}
/**
 * Login to the service, i.e. ask for an access token.
 * The access token is required to access the user data.
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.login = function (request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
/**
 * Logout from the service
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.logout = function (request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
/**
 * Load the data associated with the current user account
 * Call the provided callback with this data
 *		status		: {"success": true},
 *		data 		{
 * 						display_name: "Alexandre Hoyau",
 * 						quota_info: {
 * 						available: "5368709120",
 * 						used: "144201723"
 * 					}
 */
exports.getAccountInfo = function (request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}


// ******* commands

/**
 * List the files of a given folder
 * @result 	an object like this one:
 * {
 *   "status": {
 *     "success": true
 *   },
 *   "data": [
 *     {
 *       "revision": 80,
 *       "rev": "500c8e7ebf",
 *       "thumb_exists": false,
 *       "bytes": 0,
 *       "modified": "Thu, 03 Jan 2013 14:24:53 +0000",
 *       "path": "/Apps",
 *       "is_dir": true,
 *       "icon": "folder",
 *       "root": "dropbox",
 *       "size": "0 bytes"
 *     },
 *     
 *     ...
 *   ]
 * }
 * 
 */
exports.ls = function (path, request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
/**
 * delete a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.rm = function (path, request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
/**
 * create a folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mkdir = function (path, request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
/** 
 * Create the give file
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
 exports.cp = function (src, dst, request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
exports.mv = function (src, dst, request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
exports.put = function (path, data, request, cbk) {
	cbk({success:false, message: 'not implemented yet'});
}
exports.get = function (path, request, response, cbk) {
	var resolvedPath = pathModule.resolve(config.root+path);

	console.log('get file '+resolvedPath);
	response.sendfile(resolvedPath);
	cbk(undefined);
}
