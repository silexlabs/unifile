
/*
 * includes
 */
var router = require('./router.js')
    , urlModule = require('url')
    , pathModule = require('path')
    , options = require('../default-config.js')
    , displayRoutes = require('./display-routes.js')
    , bodyParser = require('body-parser')
    , cookieParser = require('cookie-parser')
    , cookieSession = require('cookie-session')
    , multipart = require('connect-multiparty');

/**
 * sends the response to the browser
 * @param data  the data to send to the client, wich can be either a file content or an object with this attribute
 * {
 *   "status": {"success": false/true, code: ...http code...}
 *   "data": ...
 * }
 */
function sendResponse (response, status, data, mime_type, responseFilePath) {
    if (status && status.success===false){
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
            response.setHeader('Content-Type', mime_type);
        }
        else if (data){
            // default mime type is json (only when the data is not a file, because files have their own content type)
            response.setHeader('Content-Type', 'application/json; charset=utf8');
        }
        if (data){
            response.send(JSON.stringify(data));
        }
        else if (responseFilePath){
            response.sendfile(responseFilePath);
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
            console.log(name, path, '> '+pathModule.resolve(__dirname, path));
            app.use(name, express.static(path));
        }
        else{
            console.log(path, '> '+pathModule.resolve(__dirname, path));
            app.use(express.static(path));
        }
    }
    // parse data for file upload
    app.use(options.apiRoot, multipart());

    // parse data for post data
    app.use(options.apiRoot, bodyParser({
      limit: options.maxUploadSize || 10000000
    }));

    // start session
    app.use(options.apiRoot, cookieParser());
    app.use(options.apiRoot, cookieSession({ secret: 'plum plum plum'}));

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
                    console.error('Unknown service ', serviceName);
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
        console.error('Error loading service ', serviceName, e);
        next();
    }
  };
}
