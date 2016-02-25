/**
 * Service connector for the WEBDAV protocol
 */
var utils = require('../core/utils.js');
var webdavClientsArray = [];
var webdavClientsNextId = 1;
var parseString = require('xml2js').parseString;
var pathModule = require('path');
var mime = require('mime');
var FormData = require('form-data');

var url = require("url");
var http = require("http");
var https = require("https");
var request = require("request");
var fs = require("fs");
var url = require("url");

// Global dav query object
var Dav= function(host, port, username ,password)
{
  var url_parsed = url.parse(host);

  this.fullhost = host;
  this.obj = url_parsed.protocol==='https:' ? https : http;
  this.host = url_parsed.host;
  this.port = port  || url_parsed.port || (url_parsed.protocol==='https:' ? 443 : 80);
  this.path = url_parsed.path;
  this.connected=false;

  this.header = { "Authorization": auth = "Basic " + new Buffer(username + ":" + password).toString("base64") };
};

Dav.prototype.query = function(method, path, callback, extra_headers)
{
  var data='';

  var headers = this.header;
  if(extra_headers)
  {
    for(var header in extra_headers)
    {
      headers[header] = extra_headers[header];
    }
  }

  var request = this.obj.request({
    host: this.host,
    port: this.port,
    method: method,
    path: this.path+this._encode_path(path),
    headers: headers
  });

  request.on("response", function (res) {
    if (res.statusCode < 200 || res.statusCode > 399) {
      res.on("end", function () {
        console.error('Error ',res.statusCode+' - '+res.statusMessage);
        callback(false, res.statusCode+(res.statusMessage ? ' - '+res.statusMessage : ''));
      });
    } else {
      res.on("data", function (chunk) {
        data += chunk.toString();
      });
      res.on("end", function() { callback(true, data); });
    }
    // suck stream in
    res.resume();
  });


  request.on("error", function (error) {
    console.error('Error ',error);
    callback(false, error.statusCode+' - '+error.statusMessage);
  });

  request.end();
};

// Check if connection is OK
Dav.prototype.test = function(callback)
{
  this.query('PROPFIND', '/', callback);
};
// List a folder content
Dav.prototype.list = function(path,callback)
{
  this.query('PROPFIND', path, callback);
};
// Delete a __file__
Dav.prototype.delete = function(path,callback)
{
  this.query('DELETE', path, callback);
};
// moreve a __file__
Dav.prototype.rename = function(path, destination, callback)
{
  this.query('MOVE', path, callback, {'Destination': this.path+this._encode_path(destination) });
};
// Copy a file
Dav.prototype.copy = function(path, destination, callback)
{
  this.query('COPY', path, callback, {'Destination': this.path+this._encode_path(destination) });
};

// Create new ditectory
Dav.prototype.mkdir = function(path,callback)
{
  path = path.replace(/\/+/g,'/'); // Remove doble / on the path
  path = path.replace(/\/$/,'')+'/'; // Force to have last / on the path
  this.query('MKCOL', path+'/', callback);
};

// Fetch content of a __file__
Dav.prototype.get = function(path, resolvedPath,callback)
{
  var data='';
  var error = false;
  var stream = request({
    url: this.fullhost+this._encode_path(path),
    headers: this.header
  })
  .on('response', function(res) {
    if (res.statusCode < 200 || res.statusCode > 399) {
      res.on("end", function (error) {
        callback(false, res.statusCode+(res.statusMessage ? ' - '+res.statusMessage : ''));
      });
    }
    else
    {
      res.on("end", function (error) {
        callback(true, stream);
      });
    }
  })
  .on("error", function (error) {
    callback(false, undefined);
  })
  .pipe(fs.createWriteStream(resolvedPath));
};

// Create new file
Dav.prototype.put = function(buffer, path, callback)
{
  var data='';
  var form = new FormData();
  form.append('data', buffer);

  var h = form.getHeaders();
  // Simple merge headers
  for(var key in this.header)
  {
    h[key] = this.header[key];
  }

  var request = this.obj.request({
    host: this.host,
    port: this.port,
    method: 'PUT',
    path: this.path+this._encode_path(path),
    headers: h
  });

  request.on("response", function (res) {
    if (res.statusCode < 200 || res.statusCode > 399) {
      res.on("end", function () {
        callback(false, res.statusCode+' - '+res.statusMessage);
      });
    } else {
      res.on("data", function (chunk) {
        data += chunk.toString();
      });
      res.on("end", function() { callback(true, data); });
    }
    // suck stream in
    res.resume();
  });


  request.on("error", function (error) {
    callback(false, this.statusCode+' - '+this.statusMessage);
  });

  request.end(buffer);
};

// Interal private function to encode path
Dav.prototype._encode_path = function(url)
{
  // encode uri components parts
  return url.split(/\/+/g).map(function(x)
      {
        return encodeURIComponent(x);
      }).join('/');
};

/**
 * info about this service
 * @return an object with these attributes: display_name, name, description, visible. These attributes determine the response to the request /v1.0/services/list/
 */
exports.getInfo = function (request) {
  // return requested data about this service
  return {
    name: 'webdav', // det the root of the service
    display_name: 'Webdav',
    image_small: 'unifile-assets/services/webdav.png',
    description: 'List, download and upload files from a webdav service',
    visible: true,
    isLoggedIn: exports.isLoggedIn(request),
    isConnected: exports.isConnected(request),
    isOAuth: false,
    user: request.session.webdav_user
  };
}


/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
  exports.config = options.webdav;
  // form for local auth
  app.get(exports.config.AUTH_FORM_ROUTE, function(request, response, next){
    utils.displayLoginForm(200, response, options.webdav.LOGIN_TEMPLATE_PATH, options.webdav.LOGIN_CSS_PATH, {});
  });
  // callback url for local auth
  app.post(exports.config.AUTH_FORM_SUBMIT_ROUTE, function(request, response, next){
    if (request.param('password') && request.param('username') && request.param('host') && request.param('port')){
      exports.webdavLogin(request, request.param('password'), request.param('username'), request.param('host'), request.param('port'),
          function () {
            utils.displayLoginForm(200, response, options.webdav.LOGIN_TEMPLATE_PATH, options.webdav.LOGIN_CSS_PATH, {success: true});
          },
          function (err) {
            utils.displayLoginForm(401, response, options.webdav.LOGIN_TEMPLATE_PATH, options.webdav.LOGIN_CSS_PATH, {error: true, host: request.param('host'), username: request.param('username'), port:request.param('port')});
          });
    }
    else{
      // wrong login/pass
      request.session.webdav_user = undefined;
      if (webdavClientsArray[request.session.webdavClientId]) {
        webdavClientsArray[request.session.webdavClientId] = undefined;
        request.session.webdavClientId = -1;
      }
      console.error('Wrong login or password - missing info', request.param('username'));
      utils.displayLoginForm(401, response, options.webdav.LOGIN_TEMPLATE_PATH, options.webdav.LOGIN_CSS_PATH, {error: true, host: request.param('host'), username: request.param('username'), port:request.param('port')});
    }
  });
}
exports.webdavLogin = function (request, password, username, host, port, onSuccess, onError){
  request.session.webdavClientId = webdavClientsNextId++;
  webdavClientsArray[request.session.webdavClientId] = new Dav(host, port, username, password);
  webdavClientsArray[request.session.webdavClientId].test(function(e) {
    if(e===true)
    {
      webdavClientsArray[request.session.webdavClientId].connected=true;
      // successful login
      request.session.webdav_user = {
        host: host,
        port: port,
        username: username,
        password: password
      };
      onSuccess();
    }
    else
    {
      onError();
    }
  });
};

/**
 * @return true if the user is logged in (and connected)
 */
exports.isLoggedIn = function (request) {
  return request.session.webdav_user && webdavClientsArray[request.session.webdavClientId] && webdavClientsArray[request.session.webdavClientId].connected;
}
/**
 * @return true if the user is connected
 */
exports.isConnected = function (request) {
  return request.session.webdav_user && webdavClientsArray[request.session.webdavClientId] && webdavClientsArray[request.session.webdavClientId].connected;
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
exports.logout = function (request, opt_response, opt_next, opt_cbk) {
  if (request.session.webdav_user && request.session.webdavClientId > 0 && webdavClientsArray){
    request.session.webdav_user = undefined;
    request.session.webdavClientId = null;
    if (opt_cbk) opt_cbk({success:true, message:"Now logged out."});
  }
  else{
    if (opt_cbk) opt_cbk({success:true, message:"Was not logged in."});
  }
}


/**
 * reconnect to the service, or just call cbk() if already connected
 * @param   request    the connect request
 * @param   cbk        callback to be called on error (with a err param) or success (no param)
 * @result  {"success": true}
 */
exports.reconnect = function (request, cbk) {
  var onError = function (opt_err) {
    opt_err = opt_err || '';
    console.error('could not reconnect', request.session.webdav_user, opt_err);
    cbk(opt_err);
  }
  if (exports.isLoggedIn(request)){
    cbk();
  }
  else if (request.session.webdav_user){
    exports.webdavLogin(request, request.session.webdav_user.password, request.session.webdav_user.username, request.session.webdav_user.host, request.session.webdav_user.port,
        function(){
          cbk();
        },
        onError);
  }
  else{
    onError();
  }
}


/**
 * answer that the user is not connected
 * @param   cbk        the middle ware's callback
 */
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
  if(!request || !request.session || !request.session.webdav_user)
  {
    exports.errNotLoggedIn(cbk);
  }
  else {
    cbk({"success": true},
        {
          display_name: request.session.webdav_user.username
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
  // not connected already
  if(!webdavClientsArray[request.session.webdavClientId])
  {
    return cbk({success:false, message: 'not connected'});
  }

  var dav = webdavClientsArray[request.session.webdavClientId];

  dav.list(path, function(success, data) {

    path = path.replace(/\/+/g,'/'); // Remove doble / on the path
    path = path.replace(/(^\/)|(\/$)/,''); // Remove first and last slashes
    var regPath = new RegExp('^/?'+path+'/?$');

    if (success===true){
      filesData=[];
      parseString(data, function (err, result) {
        if(!err && result['d:multistatus'] && result['d:multistatus']['d:response'])
        {
          result['d:multistatus']['d:response'].forEach(function(item)
              {
                var prop =  item['d:propstat'] && item['d:propstat'][0] && item['d:propstat'][0]['d:prop'] && item['d:propstat'][0]['d:prop'][0];
                var fullpath = decodeURIComponent(item['d:href'].toString().replace(dav.path,''));
                var name = decodeURIComponent(item['d:href'].toString().replace(/^.*?([^\/]+)\/?$/,'$1'));
                var size = parseInt( prop && prop['d:getcontentlength'] || 0);
                var is_dir = prop && JSON.stringify(prop['d:resourcetype']).indexOf('d:collection')!==-1;

                var refDate = prop['d:getlastmodified'][0]['_'] || prop['d:getlastmodified'].toString();
                var mdate = (new Date(refDate)).toISOString();

                if(!regPath.test(fullpath))
                {
                  filesData.push({

                    bytes: size,
                    modified: mdate,
                    name: name,
                    is_dir: is_dir
                  });
                }
              });
          cbk({success:true}, filesData);
        }
        else
        {
          cbk({success:false}, 'Error parsing result');
        }
      });
    }
    else {
      cbk({success:false, message: 'Error listing directory'});
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
  webdavClientsArray[request.session.webdavClientId].delete(path, function (success, msg) {
    if (success===false){
      console.error(success);
      cbk({success:false, message: 'Error deleting the file : '+msg});
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
  exports.reconnect(request, function (err) {
    if (err){
      exports.errNotLoggedIn(cbk);
    }
    else {

      webdavClientsArray[request.session.webdavClientId].mkdir(path, function (success, msg) {
        if (success===true){
          cbk({success:true});
        }
        else{
          console.error('mkdir error: ', err);
          cbk({success:false, message: 'Error while creating directory: '+msg});
        }
      });
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
  webdavClientsArray[request.session.webdavClientId].copy(src, dst, function (success, msg) {
    if (success===false){
      console.success(err);
      cbk({success:false, message: 'Error copying the item: '+msg});
    }
    else
      cbk({success:true});
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
  exports.reconnect(request, function (err) {
    if (err){
      exports.errNotLoggedIn(cbk);
    }
    else {
      webdavClientsArray[request.session.webdavClientId].rename(src, dst, function(success, msg) {
        if (success===true) {
          cbk({success:true});
        }
        else{
          cbk({success:false, message: 'Error moving the file : '+msg});
        }
      });
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
  // not connected already
  if(!webdavClientsArray[request.session.webdavClientId])
  {
    return cbk({success:false, message: 'not connected'});
  }
  var buffer = new Buffer(data);
  webdavClientsArray[request.session.webdavClientId].put(buffer, path, function(success, msg){
    if (success===true){
      cbk({success:true});
    }
    else{
      cbk({success:false, message: 'Error creating the file : '+msg});
    }
  });
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
  var resolvedPath = pathModule.resolve(__dirname, '../../download.' + Math.round(Math.random()*99999) + '.' + (new Date()).getTime() + '.tmp');
  webdavClientsArray[request.session.webdavClientId].get(path, resolvedPath, function(success, stream) {
    if (success===true && stream) {
      stream.once('close', function() {
        cbk(undefined, undefined, mime.lookup(path), resolvedPath);
        setTimeout(function(){
          try{
            fs.unlink(resolvedPath);
          }
          catch(err){
            console.error('could not unlink file (webdav::get)', err);
          }
        }, 10000);
      });
    }
    else{
      cbk({success:false, message: 'Error fetching the file: '+stream});
    }
  });
}
