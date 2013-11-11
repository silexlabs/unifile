/**
 * Service connector for the dropbox api
 *
 * Uses:
 * https://github.com/sintaxi/node-dbox
 *
 */


var dbox  = require("dbox");
var pathModule = require('path');


/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
	// config
	exports.config = options.dropbox;
	exports.dboxapp = dbox.app({"root" : exports.config.root, "app_key": exports.config.app_key, "app_secret": exports.config.app_secret })
}

/**
 * @return true if the user is logged in (and connected)
 */
exports.isLoggedIn = function (request) {
	if (request.session.dropbox_access_token)
		return true;
	return false;
}
/**
 * @return true if the user is connected
 */
exports.isConnected = function (request) {
	if (request.session.dropbox_request_token)
		return true;
	return false;
}

/**
 * info about this service
 * @return an object with these attributes: display_name, description, visible. These attributes determine the response to the request /v1.0/services/list/
 */
exports.getInfo = function (request) {
	return {
		name: 'dropbox', // det the root of the service
		display_name: 'Dropbox',
		image_small: 'unifile-assets/services/dropbox.png',
		description: 'Edit html files from your Dropbox.',
		visible: true, // true if it should be listed in /v1.0/services/list/
		isLoggedIn: exports.isLoggedIn(request),
		isConnected: exports.isConnected(request),
		user: request.session.dropbox_account
	};
}
/**
 * Connect to the service, i.e. ask for a request token.
 * The request token is required so that the user can allow our app to access his data.
 * Regenerate an auth link each time in order to avoid the expiration
 * Call the provided callback with these parameters
 *	@return 	{"success": true, authorize_url: "https://www.dropbox.com/1/oauth/authorize?oauth_token=NMCS862sIG1mP"}
 *	@return 	{"success": false, message: Oups!"}
 */
exports.connect = function (request, response, next, cbk) {
	exports.logout(request, response, next, function () {
		exports.dboxapp.requesttoken(function(status, request_token){
			if (status!==200){
				cbk(
					{
						success:true
						, message:'Was already connected. You might want to <a href="../logout/">logout</a> before connecting again.'
					}
				);
			}
			else{
				request.session.dropbox_request_token = request_token;
				request.session.dropbox_authorize_url = request_token.authorize_url;
				cbk(
					{
						success:true
						, message:'Now connected. You probably want to <a href="'+request_token.authorize_url+'">authorize unifile</a> now.'
						, authorize_url: request_token.authorize_url
					}
				);
			}
		});
	});
}
/**
 * Login to the service, i.e. ask for an access token.
 * The access token is required to access the user data.
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.login = function (request, response, next, cbk) {
	if (!request.session.dropbox_request_token){
		cbk({success:false, message:"Can not loggin, user not connected yet. You need to call the 'connect' service first."});
	}
	else{
		if (request.session.dropbox_access_token){
			cbk({success:true, message:"Was allready logged in."});
		}
		else exports.dboxapp.accesstoken(request.session.dropbox_request_token, function(status, access_token){
			if (status!==200){
				cbk(
					{success:false}
				);
			}
			else{
				request.session.dropbox_access_token = access_token;
				cbk({success:true});
			}
		})
	}
}
/**
 * Logout from the service
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.logout = function (request, response, next, cbk) {
	if (request.session.dropbox_request_token
		|| request.session.dropbox_access_token
	){
		request.session.dropbox_request_token = undefined;
		request.session.dropbox_access_token = undefined;
		cbk({success:true, message:"Now logged out."});
	}
	else{
		cbk({success:true, message:"Was not logged in."});
	}
}
/**
 * This is an internal method used to load a client object, which has several usefull methods
 */
exports.getClient = function (request) {
	if (!request.session.dropbox_access_token){
		console.error("No access token here, this is going to crash..");
		return undefined;
	}
	else{
		var client = exports.dboxapp.client(request.session.dropbox_access_token);
		return client;
	}
}
/**
 * Load the data associated with the current user account
 * Call the provided callback with this data
 *		status		: {"success": true},
 *		data 		{
 * 						display_name: "Alexandre Hoyau",
 * 						quota_info: {
 * 						available: 5368709120,
 * 						used: 144201723
 * 					}
 */
exports.getAccountInfo = function (request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).account(function(status, reply){
			if (reply){
				request.session.dropbox_account = {
						"display_name": reply.display_name,
						"quota_info": {
							"available": reply.quota_info.quota,
							"used": reply.quota_info.normal + reply.quota_info.shared
						}
					};
				cbk({"success": true}, request.session.dropbox_account);
			}
			else{
				cbk({success:false, code:401, message:"Server could not connect to dropbox."});
			}
		});
	}
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
 *       "bytes": 0,
 *       "modified": "Thu, 03 Jan 2013 14:24:53 +0000",
 *       "title": "name",
 *       "is_dir": true,
 *     },
 *
 *     ...
 *   ]
 * }
 *
 */
exports.ls = function (path, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).readdir(path, {
			details: true,
			recursive: false
		},
		function(status, reply){

			if (status!==200){
				cbk(
					{success:false, code: status},
					undefined
				);
			}
			else{
				cbk({success:true}, toFilesArray(reply));
			}
		})
	}
}
/**
 * Convert the result from dropbox api to an array of files
 * This is an internal method
 * @result 	an array of objects like this one:
 * 	[
 *     {
 *       "bytes": 0,
 *       "modified": "Thu, 03 Jan 2013 14:24:53 +0000",
 *       "title": "name",
 *       "is_dir": true,
 *     },
 *
 *     ...
 *   ]
 */
function toFilesArray (apiFiles) {
	var files = [];
	for (var idx = 0; idx<apiFiles.length; idx++){
		var fileName = apiFiles[idx].path.substr(apiFiles[idx].path.lastIndexOf("/") + 1);
		files.push({
			name: fileName,
			bytes : apiFiles[idx].bytes,
			modified : apiFiles[idx].modified,
			is_dir : apiFiles[idx].is_dir,
		});
	}
	return files;
}

/**
 * delete a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.rm = function (path, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).rm(path, function(status, reply){
			if (status!==200){
				cbk(
					{success:false}
				);
			}
			else{
				cbk({success:true});
			}
		})
	}
}
/**
 * Create a folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mkdir = function (path, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).mkdir(path, function(status, reply){
			if (status!==200){
				cbk(
					{success:false},
					undefined
				);
			}
			else{
				cbk({success:true}, reply);
			}
		})
	}
}
/**
 * Copy the give file
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
 exports.cp = function (src, dst, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).cp(src, dst, function(status, reply){
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	}
}
/**
 * Move or rename a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mv = function (src, dst, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).mv(src, dst, function(status, reply){
			if (reply.error)
				cbk({success:false, message: reply.error});
			else
				cbk({success:true});
		})
	}
}
/**
 * Create the give file
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.put = function (path, data, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).put(path, data, function(status, reply){
			if (reply.error){
				console.error(reply);
				cbk({success:false, message: reply.error});
			}
			else
				cbk({success:true});
		})
	}
}
/**
 * Get the give file, output its content
 * @return	the content of the file if there is no error
 * @return	an object with this attribute
 * {
 *   "status": {"success": false}
 * }
 */
exports.get = function (path, request, response, next, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, code:401, message:"User not logged in yet. You need to call the 'login' service first."});
	}
	else{
		exports.getClient(request).get(path, function(status, reply, metadata){
			if (status !== 200){
				cbk({success:false, code: status, message:reply.toString()});
			}else{
				cbk({success:true}, reply, metadata.mime_type);
			}
		})
	}
}
