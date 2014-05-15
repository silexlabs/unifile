/**
 * Service connector for the FTP protocol
 */
var pathModule = require('path');
var fs = require('fs');
var FtpClient = require('ftp');
var ftpClientsArray = [];
var ftpClientsNextId = 0;

/**
 * info about this service
 * @return an object with these attributes: display_name, name, description, visible. These attributes determine the response to the request /v1.0/services/list/
 */
exports.getInfo = function (request) {
  // return requested data about this service
  return {
    name: 'ftp', // det the root of the service
    display_name: 'FTP',
    image_small: 'unifile-assets/services/ftp.png',
    description: 'Edit files on a web server.',
    visible: true,
    isLoggedIn: exports.isLoggedIn(request),
    isConnected: exports.isConnected(request),
    user: request.session.ftp_user
  };
}
/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
  exports.config = options.ftp;
  // form for local auth
  app.get(exports.config.AUTH_FORM_ROUTE, function(request, response, next){
    response.send('<html><head>'+exports.config.AUTH_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_FORM_BODY_HTML+'</body></html>');
  });
  // callback url for local auth
  app.post(exports.config.AUTH_FORM_SUBMIT_ROUTE, function(request, response, next){
    if (request.param('password') && request.param('username') && request.param('host') && request.param('port')){
      request.session.ftpClientId = ftpClientsNextId++;
      ftpClientsArray[request.session.ftpClientId] = new FtpClient();
      ftpClientsArray[request.session.ftpClientId].connect({
        host: request.param('host'),
        port: request.param('port'),
        user: request.param('username'),
        password: request.param('password')
      });
      ftpClientsArray[request.session.ftpClientId].on('ready', function (){
        // successful login
        request.session.ftp_user = {
          name: request.param('username')
        };
        exports.attachSessionEvents(request);
        response.send('<html><head>'+exports.config.AUTH_SUCCESS_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_SUCCESS_FORM_BODY_HTML+'</body></html>');
      });
      ftpClientsArray[request.session.ftpClientId].on('error', function (err){
        // stop listening
        // make app crash
        // ftpClientsArray[request.session.ftpClientId].removeAllListeners();
        console.error('auth error for ', request.param('username'), err);
        response.send(401, '<html><head>'+exports.config.AUTH_ERROR_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_ERROR_FORM_BODY_HTML.replace('$username', request.param('username'))+exports.config.AUTH_FORM_BODY_HTML+'</body></html>');
      });
    }
    else{
      // wrong login/pass
      request.session.ftp_user = undefined;
      if (request.session.ftpClientsArray[request.session.ftpClientId]) {
        request.session.ftpClientsArray[request.session.ftpClientId] = undefined;
        request.session.ftpClientId = -1;
      }
      console.error('Wrong login or password - missing info', request.param('username'));
      response.send(401, '<html><head>'+exports.config.AUTH_ERROR_FORM_HEAD_HTML+'</head><body>'+exports.config.AUTH_ERROR_FORM_BODY_HTML.replace('$username', request.param('username'))+exports.config.AUTH_FORM_BODY_HTML+'</body></html>');
    }
  });
}
/**
 *
 */
exports.attachSessionEvents = function (request) {
    // remove previous event listeners
    ftpClientsArray[request.session.ftpClientId].removeAllListeners();
    // handle errors
    ftpClientsArray[request.session.ftpClientId].on('error', function (err){
        console.error('FTP error', request.param('username'), err);
        // stop listening
        ftpClientsArray[request.session.ftpClientId].removeAllListeners();
        // logged out
        if (request.session.ftp_user){
            request.session.ftp_user = undefined;
            if (request.session.ftpClientsArray[request.session.ftpClientId]) {
                request.session.ftpClientsArray[request.session.ftpClientId] = undefined;
                request.session.ftpClientId = -1;
            }
        }
        ftpClientsArray[request.session.ftpClientId].end();
    });
    // handle end of session
    var onEnd = function (err){
        console.error('FTP end', err);
        console.error('FTP end', request.param('username'));
        // stop listening
        ftpClientsArray[request.session.ftpClientId].removeAllListeners();
        // logged out
        if (request.session.ftp_user){
            request.session.ftp_user = undefined;
            if (request.session.ftpClientsArray[request.session.ftpClientId]) {
                request.session.ftpClientsArray[request.session.ftpClientId] = undefined;
                request.session.ftpClientId = -1;
            }
        }
        ftpClientsArray[request.session.ftpClientId].end();
    };
    //ftpClientsArray[request.session.ftpClientId].on('end', onEnd);
    //ftpClientsArray[request.session.ftpClientId].on('close', onEnd);
}
/**
 * @return true if the user is logged in (and connected)
 */
exports.isLoggedIn = function (request) {
  if (request.session.ftp_user && ftpClientsArray[request.session.ftpClientId] && ftpClientsArray[request.session.ftpClientId].connected)
    return true;
  return false;
}
/**
 * @return true if the user is connected
 */
exports.isConnected = function (request) {
  if (request.session.ftp_user && ftpClientsArray[request.session.ftpClientId] && ftpClientsArray[request.session.ftpClientId].connected)
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
  if (request.session.ftp_user){
    request.session.ftp_user = undefined;
    if (request.session.ftpClientsArray[request.session.ftpClientId]) {
        request.session.ftpClientsArray[request.session.ftpClientId] = undefined;
        request.session.ftpClientId = -1;
    }
    ftpClientsArray[request.session.ftpClientId].end();
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
  request.session.ftp_user.display_name);
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

  ftpClientsArray[request.session.ftpClientId].list(path, function(err, filesArray) {
    if (!err){
      var newPath = path;
      var filesData = [];
      for(var idx=0; idx<filesArray.length; idx++){
        var file = filesArray[idx];
        if (file.name && file.name != ''){
          //console.dir(file);
          filesData.push({
            bytes: file.size,
            modified: file.date,
            name: file.name,
            is_dir: file.type === 'd',
          });
        }
      }
      cbk({success:true}, filesData);
    }
    else {
      console.error(err);
      cbk({success:false, message: err});
    }
  });
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

  ftpClientsArray[request.session.ftpClientId].delete(path, function (err) {
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

  ftpClientsArray[request.session.ftpClientId].mkdir(path, function (err) {
    if (!err){
      cbk({success:true});
    }
    else{
      console.error('mkdir error: ', err);
      cbk({success:false, message: err.message, code: err.code});
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
  ftpClientsArray[request.session.ftpClientId].get(src, function(err, stream) {
    if (!err) {
      // temp file at the root of unifile
      var tmpFileName = '../../.tmp-' + request.session.ftp_user.name + '-' + Math.round(Math.random()*1000);
      tmpFileName = pathModule.resolve(__dirname, tmpFileName);
      stream.pipe(fs.createWriteStream(tmpFileName));
      ftpClientsArray[request.session.ftpClientId].put(tmpFileName, dst, function(err) {
        fs.unlink(tmpFileName, function(){
          if (!err) {
            cbk({success:true});
          }
          else{
            cbk({success:false, message: err.message, code: err.code});
          }
        });
      });
    }
    else{
      cbk({success:false, message: err.message, code: err.code});
    }
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

  exports.cp(src, dst, request, response, next, function(e){
    if (e && e.success === true){
      exports.rm(src, request, response, next, cbk);
    }
    else{
      cbk(e);
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
  try{
    var buffer = new Buffer(data);
    ftpClientsArray[request.session.ftpClientId].put(buffer, path, function(err){
      if (!err){
        cbk({success:true});
      }
      else{
        cbk({success:false, message: err.message, code: err.code});
      }
    });
  }
  catch(err){
    cbk({success:false, message: err.message, code: err.code});
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
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }

  ftpClientsArray[request.session.ftpClientId].get(path, function(err, stream) {
    if (!err) {
      var data = [];
      stream.on('data', function (chunk) {
        data = data.concat(chunk);
      });
      stream.once('end', function () {
        cbk({success:true}, data[0]);
      });
    }
    else{
      cbk({success:false, message: err.message, code: err.code});
    }
  });
}
