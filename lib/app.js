/**
 * Entry point for the unifile server
 * https://github.com/silexlabs/unifile/
 * license: GPL v2
 */


var express = require('express');
var app = express();
var router = require('./core/router');
var url = require('url');
var apiRoot = require('./core/config-manager').getConfig("apiRoot");
var isProduction = require('./core/config-manager').getConfig("debugLevel") !== 'debug';

/**
 * app init
 */
app.configure(function() {

    app.use(apiRoot, express.bodyParser());

	// start session
	app.use(apiRoot, express.cookieParser());
	app.use(apiRoot, express.cookieSession({ secret: 'plum plum plum'}));

	router.init(app, express);
});

/**
 * CORS middleware
 *
app.use(function(request, res, next) {

	// allow all domains to request the API
	var url_str = request.header('Referer');
	var domain = '*';
	if (url_str){
		var url_parts = url.parse(url_str, true);
		domain = url_parts.protocol + '//' + url_parts.host;
	}
	console.warn('give access to '+domain)
    res.header('Access-Control-Allow-Origin', domain);

    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');

    next();
});

/**
 * serve static folders
 */
var staticFolders  = require('./core/config-manager.js').getConfig('staticFolders');
var pathModule = require('path');
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

/**
 * prepare url and call the router
 */
app.use(apiRoot, function(request, response, next){
	console.log('-------------------------------------');
//	console.log(request.url, 'headers:', request.headers, request.headers.host, apiRoot);
//	console.log(request.url);
	var url_parts = url.parse(request.url, true);
	var path = url_parts.path;
	// URL decode path
	path = decodeURIComponent(path.replace(/\+/g, ' '));
	// split to be able to manipulate each folder
	var url_arr = path.split('/');
	// remove the first empty ' from the path
	url_arr.shift();
	// remove the api version number
	url_arr.shift();
	// get and remove the service name
	var serviceName = url_arr.shift();
	try{
		if (serviceName){
			var routed = router.route(serviceName, url_arr, request, response, next);
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
});

// display the routes for teting
require('./core/display-routes.js').init(app);

// server 'loop'
var port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
  console.log('Listening on ' + port);
});

// catchall error for production
if (isProduction){
	process.on('uncaughtException', function(err) {
	  console.log  ('---------------------');
	  console.error('---------------------', 'Caught exception: ', err, '---------------------');
	  console.log  ('---------------------');
	});
}
