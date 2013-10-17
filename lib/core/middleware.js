/*
 * includes
 */
var router = require('./router.js')
    , urlModule = require('url')
    , pathModule = require('path')
    , options = require('../default-config.js')
    , displayRoutes = require('./display-routes.js');
;

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
            app.use(name, express.static(pathModule.resolve(__dirname, path)));
        }
        else{
            console.log(path, '> '+pathModule.resolve(__dirname, path));
            app.use(express.static(pathModule.resolve(__dirname, path)));
        }
    }
    // app init
    app.configure(function() {

        app.use(options.apiRoot, express.bodyParser());

        // start session
        app.use(options.apiRoot, express.cookieParser());
        app.use(options.apiRoot, express.cookieSession({ secret: 'plum plum plum'}));

        // init unifile
        router.init(app, express, options);
        displayRoutes.init(app, express, options);
    });

  return function(req, res, next) {
    console.log('-------------------------------------');
    var url_parts = urlModule.parse(req.url, true);
    var path = url_parts.path;
    // URL decode path
    path = decodeURIComponent(path.replace(/\+/g, ' '));
    // split to be able to manipulate each folder
    var url_arr = path.split('/');
    console.log(url_arr);
    // remove the first empty '' from the path (first slash)
    url_arr.shift();
    // remove the 'api' path
    url_arr.shift();
    // remove the api version number
    url_arr.shift();
    console.log(url_arr);
   // get and remove the service name
    var serviceName = url_arr.shift();
    try{
        if (serviceName){
            var routed = router.route(serviceName, url_arr, req, res, next);
            if (!routed){
                console.error('Unknown service '+serviceName);
                next();
            }
        }
        else{
            // happens all the time when looking for the favicon
            //console.error('Unknown service '+serviceName);
            next();
        }
    }
    catch(e){
        console.error('Error loading service '+serviceName+': '+e);
        next();
    }
  };
}

