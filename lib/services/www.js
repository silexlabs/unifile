/**
 * Service connector for the local drive
 * This only serves files as a webserver for now
 */

// useful modules
pathModule = require('path');
fs = require('fs');

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
		response.send('<html><head>'+exports.config.AUTH_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_FORM_BODY_HTML+'</body></html>');
	});
	// callback url for local auth
	app.post(exports.config.AUTH_FORM_SUBMIT_ROUTE, function(request, response, next){
		console.log('auth page submition', request.param('username'));
		if (request.param('password') && request.param('username')
			&& exports.checkAuth(request.param('username'), request.param('password')) === true
			){
			// successful login
			request.session.www_user = {
				name: request.param('username')
			};
			// display a warning if the login/pass is admin/admin
			var warningMessage = exports.config.AUTH_FORM_WARNING;
			if (!exports.checkAuth('admin', 'admin')){
				warningMessage = '';
			}
			response.send('<html><head>'+exports.config.AUTH_SUCCESS_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_SUCCESS_FORM_BODY_HTML+warningMessage+'</body></html>');
		}
		else{
			// wrong login/pass
			console.error('Wrong login or password');
			response.send(401, '<html><head>'+exports.config.AUTH_ERROR_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_ERROR_FORM_BODY_HTML.replace('$username', request.param('username'))+exports.config.AUTH_FORM_BODY_HTML+'</body></html>');
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
		cbk({success:false, message: 'User not authorized.'});
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
	request.session.www_user.display_name);
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
	if (!exports.isLoggedIn(request)){
		exports.errNotLoggedIn(cbk);
		return;
	}

	var resolvedPath = pathModule.resolve(__dirname, exports.config.ROOT+path) + '/';

	try{
		var filesArray = fs.readdirSync(resolvedPath);
		var filesData = [];
		for(var idx=0; idx<filesArray.length; idx++){
			var file = fs.statSync(resolvedPath+filesArray[idx]);
			//console.dir(file);
			filesData.push({
				bytes: file.size,
				modified: file.mtime,
				name: filesArray[idx],
				is_dir: file.isDirectory(),
			});
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
			console.log(err);
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
				console.log('fs.mkdir callback', error);
				if (error){
					console.error('mkdir error: ', error);
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

	cbk({success:false, code:501, message: 'not implemented yet'});
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

	cbk({success:false, code:501, message: 'not implemented yet'});
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
