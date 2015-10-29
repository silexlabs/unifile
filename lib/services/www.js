/**
 * Service connector for the local drive
 * This only serves files as a webserver for now
 */

// useful modules
var pathModule = require('path');
var fs = require('fs');
var utils = require('../core/utils.js');
// polyfills in the .normalize() method being called on the strings. This method is part of ECMA6, and in future versions of Node you will not need to load unorm at all
// source: http://stackoverflow.com/questions/21208086/nodejs-compare-unicode-file-names
var unorm = require('unorm');

/**
 * info about this service
 * @return an object with these attributes: display_name, name, description, visible. These attributes determine the response to the request /v1.0/services/list/
 */
exports.getInfo = function (request) {
	// display this service only if there are users defined in the config
	// see www service in default-config.js
	var visible = false;
	for (var user in exports.config.USERS){
		visible = true;
		break;
	}
	// return requested data about this service
	return {
		name: 'www', // det the root of the service
		display_name: 'Web server',
		image_small: 'unifile-assets/services/www.png',
		description: 'Edit files on the server where Silex is installed.',
		visible: visible, // true if it should be listed in /v1.0/services/list/
		isLoggedIn: exports.isLoggedIn(request),
		isConnected: exports.isConnected(request),
		isOAuth: false,
		user: request.session.www_user
	};
}


/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
	exports.config = options.www;
	// form for local auth
	app.get(exports.config.AUTH_FORM_ROUTE, function(request, response, next){
    utils.displayLoginForm(200, response, exports.config.LOGIN_TEMPLATE_PATH, exports.config.LOGIN_CSS_PATH, {});
 	});
	// callback url for local auth
	app.post(exports.config.AUTH_FORM_SUBMIT_ROUTE, function(request, response, next){
		if (request.param('password') && request.param('username')
			&& exports.checkAuth(request.param('username'), request.param('password')) === true
			){
      console.log('auth page submition OK', request.param('username'));
			// successful login
			request.session.www_user = {
				name: request.param('username')
			};
      utils.displayLoginForm(200, response, exports.config.LOGIN_TEMPLATE_PATH, exports.config.LOGIN_CSS_PATH, {success: true});
		}
		else{
			// wrong login/pass
			console.error('Wrong login or password');
          utils.displayLoginForm(401, response, exports.config.LOGIN_TEMPLATE_PATH, exports.config.LOGIN_CSS_PATH, {error: true});
		}
	});
}
exports.checkAuth = function(username, password){
	if(exports.config.USERS[username] && exports.config.USERS[username] === password){
		return true;
	}
	return false;
}
/**
 * @return true if the user is logged in (and connected)
 */
exports.isLoggedIn = function (request) {
	if (request.session.www_user)
		return true;
	return false;
}
/**
 * @return true if the user is connected
 */
exports.isConnected = function (request) {
	if (request.session.www_user)
		return true;
	return false;
}

/**
 * Connect to the service, i.e. ask for a request token.
 * The request token is required so that the user can allow our app to access his data.
 * Regenerate an auth link each time in order to avoid the expiration
 * Call the provided callback with these parameters
 *	@return 	{"success": true, authorize_url: "https://www.dropbox.com/1/oauth/authorize?oauth_token=NMCS862sIG1m6P"}
 *	@return 	{"success": false, message: Oups!"}
 */
exports.connect = function (request, response, next, cbk) {
	if (exports.isConnected(request)){
		cbk(
			{
				success:true
				, message:'Was already connected. You might want to <a href="../logout/">logout</a> before connecting again.'
			}
		);
	}
	else{
		cbk(
			{
				success:true
				, message:'Now connected. You probably want to <a href="'+exports.config.AUTH_FORM_ROUTE+'">authenticate</a> now.'
				, authorize_url: exports.config.AUTH_FORM_ROUTE
			}
		);
	}
}
/**
 * Login to the service, i.e. ask for an access token.
 * The access token is required to access the user data.
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.login = function (request, response, next, cbk) {
	if (exports.isLoggedIn(request)){
		cbk({success:true});
	}
	else{
		cbk({success:false, code: 401, message: 'User not authorized.'});
	}
}
/**
 * Logout from the service
 * Call the provided callback with this data
 *		status		: {"success": true},
 */
exports.logout = function (request, response, next, cbk) {
	if (request.session.www_user){
		request.session.www_user = undefined;
		cbk({success:true, message:"Now logged out."});
	}
	else{
		cbk({success:true, message:"Was not logged in."});
	}
}
exports.errNotLoggedIn = function (cbk) {
	cbk({
		success:false,
		message:"User not connected yet. You need to call the 'login' service first.",
		code: 401
	});
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
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}
	cbk({"success": true},
	{
    display_name: request.session.www_user.name
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
	if (!exports.isLoggedIn(request)) {
		exports.errNotLoggedIn(cbk);
		return;
	}
	
	var resolvedPath = pathModule.resolve(__dirname, exports.config.ROOT + path) + '/';
	
	try {
		var now = Date.now();
		response._headers['etag'] = now;
		response._headerNames['etag'] = 'ETag';
		// implement weak ETag support based on directory modification times
		var etag = request.headers['if-none-match'];
		if (etag) {
			var dir_mtime = fs.statSync(resolvedPath).mtime.getTime();
			var browser_mtime = Number(etag);
			if (browser_mtime > dir_mtime && browser_mtime < now) { // cache hit
				response._headers['etag'] = etag;
				response.statusCode = 304;
				response.end("", 'utf-8');
				return;
			}
		}

		var filesArray = fs.readdirSync(resolvedPath);
		var filesData = [];
		for (var idx = 0; idx < filesArray.length; idx++) {
			try {
				var file = fs.statSync(resolvedPath + filesArray[idx]);
				file.name = filesArray[idx].normalize();
				file.is_dir = file.isDirectory();
				filesData.push(file);
			} catch (e) {
				var ignorableErrors = ["EPERM", "ENOENT", "EAGAIN", "EACCES"];
				if (ignorableErrors.indexOf(e.code) < 0) throw e;
			}
		}
		cbk({success:true}, filesData);
	}catch(e){
		console.error(e);
		cbk({success:false, message: e});
	}
}
/**
 * delete a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.rm = function (path, request, response, next, cbk) {
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}

	var resolvedPath = pathModule.resolve(__dirname, exports.config.ROOT+path);
	fs.unlink(resolvedPath, function (err) {
		if (err){
			console.error(err);
			cbk({success:false, message: err});
		}
		else
			cbk({success:true});
	});
}
/**
 * create a folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mkdir = function (path, request, response, next, cbk) {
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}

	var resolvedPath = pathModule.resolve(__dirname, exports.config.ROOT+path);
	fs.exists(resolvedPath, function (exists) {
		if (!exists){
			fs.mkdir(resolvedPath, null, function (error) {
				if (error){
					cbk({success:false, message: error.code});
				}
				else{
					cbk({success:true});
				}
			});
		}
		else{
			console.error('mkdir error: folder already exists', resolvedPath);
			cbk({success:false, message: 'folder already exists'});
		}
	});
}
/**
 * Create the give file
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
 exports.cp = function (src, dst, request, response, next, cbk) {
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}

  var resolvedSrc = pathModule.resolve(__dirname, exports.config.ROOT + src);
  var resolvedDst = pathModule.resolve(__dirname, exports.config.ROOT + dst);
  // Check that the file exists
  fs.exists(resolvedSrc, function (exists) {
    var read,
        write;

    if (!exists) {
      cbk({success:false, code:404, message: 'source file not found: ' + src});
      return;
    }

    // Copy src to dst
    read = fs.createReadStream(resolvedSrc);
    read.on('error', function (err) {
      cbk({success:false, message: 'could not open source file: ' + resolvedSrc});
    });
    read.on('end', function(){
      cbk({success:true});
    });
    write = fs.createWriteStream(resolvedDst);
    write.on('error', function (err) {
      cbk({success:false, message: 'could not open dest file for writting: ' + resolvedDst});
    });
    read.pipe(write);
  });
}
/**
 * Move or rename a file or folder
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.mv = function (src, dst, request, response, next, cbk) {
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}
  exports.cp(src, dst, request, response, next, function(res){
    if (res.success === false){
      cbk(res);
    }
    else{
      // remove the old one
      exports.rm(src, request, response, next, cbk);
    }
  });
}
/**
 * Create the give file
 * @return	an object with this attribute
 * {
 *   "status": {"success": true}
 * }
 */
exports.put = function (path, data, request, response, next, cbk) {
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}

	var resolvedPath = pathModule.resolve(__dirname, exports.config.ROOT+path);

	var file = fs.createWriteStream(resolvedPath);
	file.write(data);

	cbk({success:true});
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
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}

	var resolvedPath = pathModule.resolve(__dirname, exports.config.ROOT+path);
	cbk(undefined, undefined, undefined, resolvedPath);
}
