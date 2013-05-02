
// check https://developers.google.com/drive/quickstart-js

/**
 * Service connector for the google drive api
 * 
 * Uses:
 * https://github.com/google/google-api-nodejs-client
 * 
 * the app must be decalred in https://code.google.com/apis/console/
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
	console.log("init gdrive");
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
	exports.logout(request, function () {
		var url = oauth2Client.generateAuthUrl({
		  access_type: config.app_access_type,
		  scope: config.app_scope
		});
		cbk({success:true}, url);
	});
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
/*		if (request.session.gdrive_account){
			console.log("stored account data:");
			console.dir(request.session.gdrive_account);
			cbk({success:true, message:"Was allready logged in."});
		}
		else*/ oauth2Client.getToken(request.session.gdrive_request_token, function(err, tokens) {
		  // contains an access_token and optionally a refresh_token.
		  // save them permanently.
		  console.log("---");
		  console.log("getToken : ");
		  console.dir(err);
		  console.dir(tokens);
		  console.log("---");
			
			request.session.gdrive_token = tokens;
			
			oauth2Client.credentials = {
			  access_token : request.session.gdrive_token.access_token,
			  refresh_token : request.session.gdrive_token.refresh_token,
			};

			// get the account info, in order to have an easy access to rootFolderId
			getAccount(request, function (status, data) {
				request.session.gdrive_account = 
					{
						name : data.name,
						user : data.user,
						quotaBytesTotal : data.quotaBytesTotal,
						quotaBytesUsed : data.quotaBytesUsed,
						quotaBytesUsedAggregate : data.quotaBytesUsedAggregate,
						quotaBytesUsedInTrash : data.quotaBytesUsedInTrash,
						rootFolderId : data.rootFolderId,
					}
				console.log("store account data: "+data.rootFolderId);
				//console.dir(data);
				//console.dir(status);
				cbk({success:true});
			})
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
		|| request.session.gdrive_token
		|| request.session.gdrive_account
	){
		request.session.gdrive_request_token = undefined;
		request.session.gdrive_token = undefined;
		request.session.gdrive_account = undefined;
		cbk({success:true, message:"Now logged out."});
	}
	else{
		cbk({success:true, message:"Was not logged in."});
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
	if (!request.session.gdrive_account){
		console.log ("gdrive_account is "+request.session.gdrive_account);
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
	}
	else{
//		getAccount(request, function (resp) {
			var resp = request.session.gdrive_account;
			cbk({"success": true},
		    	{
					"display_name": resp.user.displayName,
					"quota_info": {
						"available": resp.quotaBytesTotal,
						"used": resp.quotaBytesUsed
					},
		    	});
//		});
	}
}
/**
 * Retrive the info about the user account
 * This is an internal method
 * @result 	an object like this one:
 * {
 *   "status": {
 *     "success": true
 *   },
 *   "data": {
 *     "display_name": "Alexandre Hoyau",
 *     "quota_info": {
 *       "available": "5368709120",
 *       "used": "144208896"
 *     }
 *  }
 * }
 * 
 */
getAccount = function (request, cbk) {
	console.log("getAccount");
	console.dir(request.session.gdrive_token);
	oauth2Client.credentials = request.session.gdrive_token;

	googleapis
	.discover('drive', 'v2')
	.execute(function(err, client) {
		console.log("Client :");
		client
		.drive.about.get()
		.withAuthClient(oauth2Client)
		.execute(function (status, resp, c) {
	    	//console.dir((resp));
	    	cbk(status, resp);
		});
	});
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
 *       "title": "test",
 *       "is_dir": true,
 *     },
 *     
 *     ...
 *   ]
 * }
 * 
 */
exports.ls = function (path, request, cbk) {
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
	}
	else{
		// det the search querry
		path_arr = path.split("/");
		search_params = {};
		if (path_arr.length>2){
			// remove the first empty item
			path_arr.shift();
			// remove the last empty item
			if (path_arr[path_arr.length-1]=="") path_arr.pop();

			// path of the file
			//search_params["q"] = "title = '"+path_arr.join("/")+"'";
			// yes : search_params["q"] = "title = '"+path_arr[path_arr.length-1]+"'";
			//search_params["q"] = "'"+path_arr[path_arr.length-1]+"' in parents";

			search_folder_recursive(path_arr, null, request, function (folder) {
				if (folder){
					console.log("folder found "+folder.title);
					console.log("List folder with id "+folder.id);
					listFiles(folder.id, request, cbk);
				}
				else{
					cbk ({success:false});
				}
			});
		}
		else{
			listFiles(request.session.gdrive_account.rootFolderId, request, cbk);
		}
	}
}
/**
 * List the files of the given folder
 * This is an internal method
 * @result 	an array of objects like this one:
 * 	[
 *     {
 *       "bytes": 0,
 *       "modified": "Thu, 03 Jan 2013 14:24:53 +0000",
 *       "title": "test",
 *       "is_dir": true,
 *     },
 *     
 *     ...
 *   ]
 */
 function listFiles (folder_id, request, cbk) {
	oauth2Client.credentials = request.session.gdrive_token;
	var search_params = {};
	if (folder_id)
		search_params.q = "'"+folder_id+"' in parents";
	else
		search_params.q = "'"+request.session.gdrive_account.rootFolderId+"' in parents";

	googleapis
	.discover('drive', 'v2')
	.execute(function(err, client) {
		client
		.drive.files.list(search_params)
		.withAuthClient(oauth2Client)
		.execute(function (a, result, c) {

			if(result && result.items){				
		    	console.log(result.items.length+" results ");
		    	cbk ({success:true}, toFilesArray(result));
			}
			else
		    	cbk ({success:false});
		});
	});		
}
/**
 * Convert the result from gdrive api to an array of files
 * This is an internal method
 * @result 	an array of objects like this one:
 * 	[
 *     {
 *       "bytes": 0,
 *       "modified": "Thu, 03 Jan 2013 14:24:53 +0000",
 *       "title": "test",
 *       "is_dir": true,
 *     },
 *     
 *     ...
 *   ]
 */
function toFilesArray (gdriveFiles) {
	var files = [];
	for (var idx = 0; idx<gdriveFiles.items.length; idx++){
		files.push({
			name: gdriveFiles.items[idx].title,
			bytes : gdriveFiles.items[idx].quotaBytesUsed,
			modified : "Thu, 03 Jan 2013 14:24:53 +0000",
			is_dir : gdriveFiles.items[idx].kind=="drive#folder",
		});
	}
	return files;
}
/**
 * Recursive function which let us get the ids of each folder in the desired path
 * This is an internal method
 * @return	a folder object from gdrive api
 */
 function search_folder_recursive(path_arr, parent_id, request, cbk) {
	console.log("search_folder_recursive "+path_arr+", "+parent_id);
	search_folder(path_arr.shift(), parent_id, request, function (folder) {
		if (folder){
			console.log("folder found "+folder.title);
			if(path_arr.length>0){
				search_folder_recursive(path_arr, folder.id, request, cbk);
			}
			else cbk(folder);
		}
		else cbk(undefined);
	});
}
/**
 * Get the id of the folder with the given parent and name
 * This is an internal method
 * @return	a folder object from gdrive api
 */
function search_folder(title, parent_id, request, cbk) {
	var search_param = {q:"title='"+title+"'"};
	if (parent_id)
		search_param.q += " and '"+parent_id+"' in parents";
	else
		search_param.q += " and '"+request.session.gdrive_account.rootFolderId+"' in parents";

	oauth2Client.credentials = request.session.gdrive_token;
	googleapis
	.discover('drive', 'v2')
	.execute(function(err, client) {
		console.log("Now search for "+search_param.q);
		client
		.drive.files.list(search_param)
		.withAuthClient(oauth2Client)
		.execute(function (a, result, c) {

			if(result && result.items && result.items.length>0){		
		    	cbk (result.items[0]);
			}
			else{
				console.log("Error: could not find the folder named "+title);
				console.dir(a);
				cbk(undefined);
			}
		});
	});
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
 *
exports.ls_r = function (path, request, cbk) {
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
	}
	else{
		oauth2Client.credentials = request.session.gdrive_token;

		// det the search querry
		path_arr = path.split("/");
		search_params = {};
		if (path_arr.length>1){
			// remove the first empty item
			path_arr.shift();
			// remove the last empty item
			if (path_arr[path_arr.length-1]=="") path_arr.pop();

			// path of the file
			//search_params["q"] = "title = '"+path_arr.join("/")+"'";
			// yes : search_params["q"] = "title = '"+path_arr[path_arr.length-1]+"'";
			//search_params["q"] = "'"+path_arr[path_arr.length-1]+"' in parents";
		}

		googleapis
		.discover('drive', 'v2')
		.execute(function(err, client) {
			console.log("Client "+client);
			console.log("search for "+search_params.q);
			client
			.drive.files.list(search_params)
			.withAuthClient(oauth2Client)
			.execute(function (status, result, c) {
		    	console.log("Got result: "+status+", "+result+", "+c);
		    	console.dir(status);
		    	console.log("----");
		    	console.dir(result);
		    	console.log("----");
				if(result && result.items){	

			    	console.log(result.items.length+" results ");

					var files = [];
					for (var idx = 0; idx<result.items.length; idx++){
						files.push(result.items[idx].title);
					}

			    	cbk ({success:true}, files);
				}
				else
			    	cbk ({success:false});
			});
		});
	}
}
/**
 * delete a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.rm = function (path, request, cbk) {
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
	}
	else{
		// det the search querry
		path_arr = path.split("/");
		search_params = {};
		if (path_arr.length>2){
			// remove the first empty item
			path_arr.shift();
			// remove the last empty item
			if (path_arr[path_arr.length-1]=="") path_arr.pop();
			// get the last item and assume it is the file to delete

			search_folder_recursive(path_arr, null, request, function (file) {
				if (file){
					console.log("file found "+file.title);
					console.log("List file with id "+file.id);
					deleteFile(file, request, cbk);
				}
				else{
					cbk ({success:false});
				}
			});
		}
	}
}
/** 
 * Delete the give file
 */
function deleteFile (file, request, cbk) {
	oauth2Client.credentials = request.session.gdrive_token;
	googleapis
	.discover('drive', 'v2')
	.execute(function(err, client) {
		console.log("Now delete "+file.title+ " - "+file.id);
		try{
			client
			.drive.files.delete(file.id)
			.withAuthClient(oauth2Client)
			.execute(function (a, b, c) {
				console.log("File deleted "+file.title);
				cbk ({success:true});
			});
		}
		catch(e){
			console.error("Error while deleting file "+file.title+". Error: "+e);
		}
	});
}
exports.mkdir = function (path, request, cbk) {
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
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
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
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
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
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
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
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
	if (!request.session.gdrive_token){
		cbk({success:false, message:"User not connected yet. You need to call the 'login' service first."});
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
