/**
 * Service connector for the open pages connector
 * This is free hosting for static files
 * Authentication is made with mozilla's Persona project
 */

// useful modules
var pathModule = require('path');
var fs = require('fs');
var utils = require('../core/utils.js');
// polyfills in the .normalize() method being called on the strings. This method is part of ECMA6, and in future versions of Node you will not need to load unorm at all
// source: http://stackoverflow.com/questions/21208086/nodejs-compare-unicode-file-names
var unorm = require('unorm');
var querystring = require('querystring');
var https = require('https');
var sqlite3 = require('sqlite3').verbose();

/**
 * info about this service
 * @return an object with these attributes: display_name, name, description, visible. These attributes determine the response to the request /v1.0/services/list/
 */
exports.getInfo = function (request) {
  // return requested data about this service
  return {
    name: 'open-pages', // det the root of the service
    display_name: 'Open Pages',
    image_small: 'unifile-assets/services/open-pages.png',
    description: 'Manage files from your Open Pages account.',
    visible: true, // true if it should be listed in /v1.0/services/list/
    isLoggedIn: exports.isLoggedIn(request),
    isConnected: exports.isConnected(request),
    isOAuth: false,
    user: exports.getSessionObject(request)
  };
}


/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
  exports.config = options.openPages;
  // form for local auth
  app.get(exports.config.AUTH_FORM_ROUTE, function(request, response, next){
    var siteName = '';
    utils.displayLoginForm(200, response, exports.config.LOGIN_TEMPLATE_PATH, exports.config.LOGIN_CSS_PATH, {"siteName": siteName});
  });


  // callback url for local auth
  app.post(exports.config.AUTH_FORM_SUBMIT_ROUTE, function(request, response, next){
    var assertion = request.param('assertion');
    var audience = request.param('audience');
    var folder = request.param('folder');

    // Build the post string from an object
    var postData = querystring.stringify({
      'assertion': assertion,
      'audience': audience
    });

    // An object of options to indicate where to post to
    var postOptions = {
      host: 'verifier.login.persona.org',
      path: '/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };
    // Set up the request
    var postReq = https.request(postOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (buff) {
        var data = JSON.parse(buff.toString());
        if(data.email && data.status === 'okay') {
          // check rigths for this user and site name
          exports.associateUserToFolder(data.email, folder, function(err) {
            if (!err) {
              // successful login
              request.session.open_pages_user = data;
              request.session.open_pages_user.folder = data.email;
              request.session.open_pages_user.display_name = data.email;
              exports.mkdir('/', request, response, next, function(status) {
                if (status.success === true) {
                  response.end("{'success': true, message: 'You are logged in as " + data.email + "', code: 200}");
                }
                else {
                  response.end("{'success': false, message: 'Logg in successful, but could not create home directory', code: 500}");
                }
              });
            }
            else {
              response.end("{'success': false, message: '" + err + "', code: 401}");
            }
          });
        }
        else {
          response.end("{'success': false, message: 'Wrong login or password', code: 401}");
        }
      });
      res.on('error', function(e) {
        response.end("{'success': false, message: 'Wrong login or password', code: 401}");
      });
    });
    // post the data
    postReq.write(postData);
    postReq.end();
  });
}

/**
 * will call cbk with error or null
 */
exports.associateUserToFolder = function(email, folder, cbk) {
  var db = new sqlite3.Database(exports.config.SQLLITE_FILE);
  db.run('CREATE TABLE IF NOT EXISTS open_pages (email TEXT PRIMARY KEY, folder TEXT)');

  // if the folder exists, it must be already associated with the user
  db.each("SELECT * FROM open_pages WHERE folder=?", folder, function(err, row) {
      if(err) {
        db.close();
        cbk(err);
      }
      else if(row.email !== 'email') {
        db.close();
        cbk('This website name is already taken.');
      }
  }, function(err, numRows) {
    if (err) {
      db.close();
      cbk(err);
    }
    else if(numRows === 0) {
      setTimeout(function(){
        // if the user exists, update the assosciation
        db.each("SELECT * FROM open_pages WHERE email=?", email, function(err, row) {
          if(err) {
            db.close();
            cbk(err);
          }
          else {
            // update
            db.run('UPDATE open_pages set folder=? WHERE email=?', folder, email, function(){
              // db.close();
              cbk();
            });
          }
        }, function(err, numRows) {
          if (err) {
            db.close();
            cbk(err);
          }
          else if(numRows === 0) {
            // cerate the record
            db.run('INSERT INTO open_pages VALUES (?,?)', email, folder, function(){
              db.close();
              cbk();
            });
          }
          else {
            db.close();
            cbk();
          }
        });
      }, 0);
    }
    else {
      db.close();
      cbk();
    }
  });
}

exports.getRootPath = function(request, path) {
  var resolvedPath = pathModule.resolve(exports.config.ROOT + '/' + request.session.open_pages_user.folder + '/' + path);
  return resolvedPath;
}


exports.getSessionObject = function(request) {
  return request.session.open_pages_user;
}


exports.setSessionObject = function(request, value) {
  request.session.open_pages_user = value;
}


/**
 * @return true if the user is logged in (and connected)
 */
exports.isLoggedIn = function (request) {
  if (exports.getSessionObject(request))
    return true;
  return false;
}
/**
 * @return true if the user is connected
 */
exports.isConnected = function (request) {
  if (exports.getSessionObject(request))
    return true;
  return false;
}

/**
 * Connect to the service, i.e. ask for a request token.
 * The request token is required so that the user can allow our app to access his data.
 * Regenerate an auth link each time in order to avoid the expiration
 * Call the provided callback with these parameters
 *  @return   {'success': true, authorize_url: "https://www.dropbox.com/1/oauth/authorize?oauth_token=NMCS862sIG1m6P"}
 *  @return   {'success': false, message: Oups!"}
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
 *    status    : {'success': true},
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
 *    status    : {'success': true},
 */
exports.logout = function (request, response, next, cbk) {
  if (exports.getSessionObject(request)){
    exports.setSessionObject(request, undefined);
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
 *    status    : {'success': true},
 *    data    {
 *            display_name: "Alexandre Hoyau",
 *            quota_info: {
 *            available: 5368709120,
 *            used: 144201723
 *          }
 */
exports.getAccountInfo = function (request, response, next, cbk) {
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }
  cbk({'success': true}, exports.getSessionObject(request));
}


// ******* commands

/**
 * List the files of a given folder
 * @result  an object like this one:
 * {
 *   "status": {
 *     'success': true
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

  var resolvedPath = exports.getRootPath(request, path) + '/';

  try{
    var filesArray = fs.readdirSync(resolvedPath);
    var filesData = [];
    for(var idx=0; idx<filesArray.length; idx++){
      var file = fs.statSync(resolvedPath+filesArray[idx]);
      filesData.push({
        bytes: file.size,
        modified: file.mtime,
        name: filesArray[idx].normalize(),
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
 * @return  an object with this attribute
 * {
 *   "status": {'success': true}
 * }
 */
exports.rm = function (path, request, response, next, cbk) {
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }

  var resolvedPath = exports.getRootPath(request, path);
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
 * @return  an object with this attribute
 * {
 *   "status": {'success': true}
 * }
 */
exports.mkdir = function (path, request, response, next, cbk) {
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }

  var resolvedPath = exports.getRootPath(request, path);
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
      //console.error('mkdir error: folder already exists', resolvedPath);
      cbk({success:false, message: 'folder already exists'});
    }
  });
}
/**
 * Create the give file
 * @return  an object with this attribute
 * {
 *   "status": {'success': true}
 * }
 */
 exports.cp = function (src, dst, request, response, next, cbk) {
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }

  var resolvedSrc = exports.getRootPath(request, src);
  var resolvedDst = exports.getRootPath(request, dst);
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
 * @return  an object with this attribute
 * {
 *   "status": {'success': true}
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
 * @return  an object with this attribute
 * {
 *   "status": {'success': true}
 * }
 */
exports.put = function (path, data, request, response, next, cbk) {
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }

  var resolvedPath = exports.getRootPath(request, path);

  var file = fs.createWriteStream(resolvedPath);
  file.write(data);

  cbk({success:true});
}
/**
 * Get the give file, output its content
 * @return  the content of the file if there is no error
 * @return  an object with this attribute
 * {
 *   "status": {'success': false}
 * }
 */
exports.get = function (path, request, response, next, cbk) {
  if (!exports.isLoggedIn(request)){
    exports.errNotLoggedIn(cbk);
    return;
  }

  var resolvedPath = exports.getRootPath(request, path);
  cbk(undefined, undefined, undefined, resolvedPath);
}
