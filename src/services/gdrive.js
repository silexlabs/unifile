
// check https://developers.google.com/drive/quickstart-js

/**
 * Service connector for the google drive api
 * 
 * Uses:
 * https://github.com/google/google-api-nodejs-client
 * 
 * the app must be decalred 
 * and have a callback url set to [node server url]/gdrive/auth_callback/
 */

// config

var config  = require("./config").gdrive;

// init googleappis 
var googleapis = require('googleapis');
var OAuth= require('oauth').OAuth;
var googleapis = require('googleapis'),
    OAuth2Client = googleapis.OAuth2Client;
var oauth2Client =
    new OAuth2Client(config.client_id, config.client_secret, config.redirect_uris[0]);

// ******* Internal Methods

/**
 * init the service global vars
 */
exports.init = function (app, express) {

	// callback url from google
	app.get(config.auth_url_callback, function(request, response, next){
		var url = require('url');
		var url_parts = url.parse(request.url, true);
		var query = url_parts.query;
		console.log("google_auth coming from google with code ");
		console.dir(request.query);
		if (request.query.code){
			request.session.gdrive_request_token = request.query.code;
			response.send("<html><head></head><body>close this window please, and proceed to login</body></html>");
		}
		else{
			response.send("<html><head></head><body>An error occured, no code from google</body></html>");
		}
	});
}

/**
 * Connect to the service, i.e. ask for a request token.
 * The request token is required so that the user can allow our app to access his data.
 * Call the provided callback with these parameters
 *		status			: {"success": true},
 *		authorize_url	: "https://www.dropbox.com/1/oauth/authorize?oauth_token=NMCS862sIG1P5m6P"
 */
exports.connect = function (request, cbk) {

// generates a url allows offline access and asks permissions
	var url = oauth2Client.generateAuthUrl({
	  access_type: config.app_access_type,
	  scope: config.app_scope
	});
	cbk({success:true}, url);
}

/**
 * Login to the service, i.e. ask for an access token.
 * The access token is required to access the user data.
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.login = function (request, cbk) {
	if (!request.session.gdrive_request_token){
		cbk({success:false, message:"Can not loggin, user not connected yet. You need to call the \"connect\" service first."});
	}
	else{
		if (request.session.gdrive_access_token){
			cbk({success:true, message:"Was allready logged in."});
		}
		else oauth2Client.getToken(request.session.gdrive_request_token, function(err, tokens) {
		  // contains an access_token and optionally a refresh_token.
		  // save them permanently.
		  console.log("---");
		  console.log("getToken : ");
		  console.dir(err);
		  console.dir(tokens);
		  console.log("---");
			
			request.session.gdrive_access_token = tokens;
			
			cbk({success:true});
		});


	}
}
/**
 * Logout from the service
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.logout = function (request, cbk) {
	if (request.session.gdrive_request_token 
		|| request.session.gdrive_access_token
	){
		request.session.gdrive_request_token = undefined;
		request.session.gdrive_access_token = undefined;
		cbk({success:true, message:"Now logged out."});
	}
	else{
		cbk({success:true, message:"Was not logged in."});
	}
}
/**
 * This is an internal method used to load a client object, which has several usefull methods
 */
exports.getClient = function (request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk(undefined);
	}
	else{
		var client = dboxapp.client(request.session.gdrive_access_token)
		  cbk(client);
	}
}
/**
 * Load the data associated with the current user account
 * Call the provided callback with this data
 *		status		: {"success": true},
 *		data 		: {
 *				  "status": {
 *				    "success": true
 *				  },
 *				  "data": {
 *				    "referral_link": "https://www.dropbox.com/referrals/NTEzMDU1OTM1Mzk?src=app9-292538",
 *				    "display_name": "alex hoyau",
 *				    "uid": 130559353,
 *				    "country": "FR",
 *				    "quota_info": {
 *				      "shared": 0,
 *				      "quota": 2147483648,
 *				      "normal": 4368357
 *				    },
 *				    "email": "billy321@im-paris.fr"
 *				  }
 *				}
 */
exports.getAccountInfo = function (request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.account(function(status, reply){
				console.log("status: "+status);
				cbk(reply);
			})
		})
	}
}


// ******* commands

exports.ls_l = function (path, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.readdir(path, {
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
		});
	}
}
exports.ls_r = function (path, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.readdir(path, {
				details: false,
				recursive: true
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
		});
	}
}
exports.rm = function (path, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.rm(path, function(status, reply){
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
		});
	}
}
exports.mkdir = function (path, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.mkdir(path, function(status, reply){
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
		});
	}
}
exports.cp = function (src, dst, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.cp(src, dst, function(status, reply){
				console.log("status: "+status);
				if (reply.error)
					cbk({success:false}, reply);
				else
					cbk({success:true}, reply);
			})
		});
	}
}
exports.mv = function (src, dst, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.mv(src, dst, function(status, reply){
				console.log("status: "+status);
				if (reply.error)
					cbk({success:false}, reply);
				else
					cbk({success:true}, reply);
			})
		});
	}
}
exports.put = function (path, data, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.put(path, data, function(status, reply){
				console.log("status: "+status);
				if (reply.error)
					cbk({success:false}, reply);
				else
					cbk({success:true}, reply);
			})
		});
	}
}
exports.get = function (path, request, cbk) {
	if (!request.session.gdrive_access_token){
		cbk({success:false, message:"User not connected yet. You need to call the \"login\" service first."});
	}
	else{
		exports.getClient(request, function (client) {
			client.get(path, function(status, reply, metadata){
				console.log("status: "+status);
				if (reply.error)
					cbk({success:false}, reply, reply.toString(), metadata);
				else
					cbk({success:true}, reply, reply.toString(), metadata);
			})
		});
	}
}
