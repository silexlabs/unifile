/**
 * Service connector for the dropbox api
 * 
 * Uses:
 * https://github.com/sintaxi/node-dbox
 * 
 */

// config

var config  = require("../config").dropbox;
var dbox  = require("dbox");
//var dboxapp   = dbox.app({ "app_key": "svr5id53hug36a7", "app_secret": "mpbhr91louaqk6o" })
//var dboxapp   = dbox.app({"root" : "dropbox", "app_key": "rvz6kvs9394dx8a", "app_secret": "b0stxoj0zsxy14m" })

var dboxapp   = dbox.app({"root" : config.root, "app_key": config.app_key, "app_secret": config.app_secret })

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
	exports.logout(request, function () {
		dboxapp.requesttoken(function(status, request_token){
			if (status!=200){
				console.log("status: "+status);
				cbk(
					{success:false}, 
					undefined
				);
			}
			else{
				request.session.dropbox_request_token = request_token;
				request.session.dropbox_authorize_url = request_token.authorize_url;
				cbk(
					{success:true}, 
					request_token.authorize_url
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
exports.login = function (request, cbk) {
	if (!request.session.dropbox_request_token){
		cbk({success:false, message:"Can not loggin, user not connected yet. You need to call the \"connect\" service first."});
	}
	else{
		if (request.session.dropbox_access_token){
			cbk({success:true, message:"Was allready logged in."});
		}
		else dboxapp.accesstoken(request.session.dropbox_request_token, function(status, access_token){
			if (status!=200){
				console.log("status: "+status);
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
exports.logout = function (request, cbk) {
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
		var client = dboxapp.client(request.session.dropbox_access_token)
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
 * 						available: "5368709120",
 * 						used: "144201723"
 * 					}
 */
exports.getAccountInfo = function (request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).account(function(status, reply){
			console.log("status: "+status);
			cbk(reply);
		})
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
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).readdir(path, {
			details: true,
			recursive: false
		}, 
		function(status, reply){
			if (status!=200){
				console.log("status: "+status);
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
 * @return {
 *   "status": {
 *     "success": true
 *   },
 *   "data": [
 *     "/Apps",
 *     "/Photos",
 *     "/test",
 *     "/Apps/Silex",
 *     "/Photos/Sample Album",
 *     "/test/temp.txt.html",
 *     "/test/temp.txt.txt",
 *     "/Photos/Sample Album/Boston City Flow.jpg",
 *     "/Photos/Sample Album/test.png",
 *     "/Apps/Silex/assets",
 *     "/Apps/Silex/scripts",
 *     "/Apps/Silex/your-file-68.html",
 *   ]
 * }
exports.ls_r = function (path, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).readdir(path, {
			details: false,
			recursive: true
		},
		function(status, reply){
			if (status!=200){
				console.log("status: "+status);
				cbk(
					{success:false, message: status}, 
					undefined
				);
			}
			else{
				cbk({success:true}, reply);
			}
		})
	}
}
 */

/**
 * delete a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.rm = function (path, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).rm(path, function(status, reply){
			if (status!=200){
				console.log("status: "+status);
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
 * create a folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mkdir = function (path, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).mkdir(path, function(status, reply){
			if (status!=200){
				console.log("status: "+status);
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
 * Create the give file
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
 exports.cp = function (src, dst, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).cp(src, dst, function(status, reply){
			console.log("status: "+status);
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	}
}
exports.mv = function (src, dst, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).mv(src, dst, function(status, reply){
			console.log("status: "+status);
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	}
}
exports.put = function (path, data, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).put(path, data, function(status, reply){
			console.log("status: "+status);
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	}
}
exports.get = function (path, request, cbk) {
	if (!request.session.dropbox_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request).get(path, function(status, reply, metadata){
			console.log("status: "+status);
			if (reply.error)
				cbk({success:false}, reply.toString(), metadata);
			else
				cbk(reply.toString());
		})
	}
}
