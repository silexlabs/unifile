
/*
 * includes
 */
var router = require('./router.js');
var urlModule = require('url');
var pathModule = require('path');
var options = require('../default-config.js');
var displayRoutes = require('./display-routes.js');

/**
 * sends the response to the browser
 * @param data  the data to send to the client, wich can be either a file content or an object with this attribute
 * {
 *   "status": {"success": false/true, code: ...http code...}
 *   "data": ...
 * }
 */
function sendResponse (response, status, data, mime_type, responseFilePath) {
    // warn if headers have been sent already
    if (response.headerSent === true){
        // this seems to happen with the FTP module
        console.error('Error: sendResponse could not set headers because they have been sent already.', status);
    }
    // warn and stop if response has been sent already
    if (response.finished === true){
        // this seems to happen with the FTP module
        console.error('Error: sendResponse could not send response because it has been sent already.', status);
        return;
    }
    if (status && status.success === false){
        var code;
        if (status.code) code = status.code;
        else code = 500;

        console.error("error code ", code, status);
        response.statusCode = code;
        response.send(status);
    }
    // set mime type
    else{
        if (mime_type){
            // mime type
            if(response.headerSent !== true) {
                response.setHeader('Content-Type', mime_type);
            }
        }
        else if (data){
            // default mime type is json (only when the data is not a file, because files have their own content type)
            if(response.headerSent !== true) {
                response.setHeader('Content-Type', 'application/json; charset=utf8');
            }
            data = JSON.stringify(data);
        }
        if (data){
            response.send(data);
        }
        else if (responseFilePath){
            response.sendFile(responseFilePath);
        }
        else{
            response.send(status);
        }
    }
}

/*
 * The middleware
 */
exports.middleware = function(express, app, opt_options) {
    // get options
    var options = opt_options || require('../default-config.js');

    // serve static folders
    var staticFolders  = options.staticFolders;
    for(var folder in staticFolders){
        var name = staticFolders[folder].name;
        var path = staticFolders[folder].path;
        if (name){
            app.use(name, express.static(path));
        }
        else{
            app.use(express.static(path));
        }
    }

    // init unifile
    router.init(app, express, options);
    displayRoutes.init(app, express, options);

  return function(req, res, next) {

    var url_parts = urlModule.parse(req.url, true);
    var path = url_parts.path;
    // URL decode path
    path = decodeURIComponent(path.replace(/\+/g, ' '));
    // remove api root path
    if (path.indexOf(options.apiRoot) > -1) {
        path = path.substr(path.lastIndexOf(options.apiRoot)+options.apiRoot.length);
    }
    // split to be able to manipulate each folder
    var url_arr = path.split('/');
    // remove the first empty '' from the path (first slash)
    url_arr.shift();
    // remove the api version number
    url_arr.shift();
   // get and remove the service name
    var serviceName = url_arr.shift();
    try{
        if (serviceName){
            var routed = router.route(serviceName, url_arr, req, res, next, sendResponse);
            if (!routed){
                if (options.debug) {
                    console.error('Unknown service ', serviceName + ' (', path, ')');
                }
                next();
            } else {
              // ok, do nothing
            }
        }
        else{
            // happens all the time when looking for the favicon
            //console.error('Unknown service ', serviceName);
            next();
        }
    }
    catch(e){
        console.error('Error loading service ', serviceName, e, e.stack);
        next();
    }
  };
}
