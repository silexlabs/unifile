/**
 * Test of a node service to handle dropbox interactions
 * 
 * Status:
 * It is able to connect, then the user accepts the app, then login and get account info
 * 
 * Next step: 
 * Output json and handle errors
 * Finish to implement te commands to manipulate files
 * Make a unified services for other cloud storage libs
 * 
 * 
 * 
 * Test:
 * start here http://localhost:5000/ 
 * and follow the links...
 * http://localhost:5000/connect/ 
 * http://localhost:5000/login/
 * http://localhost:5000/logout/
 * http://localhost:5000/account/
 * http://localhost:5000/exec/ls-l/
 * http://localhost:5000/exec/ls-r/
 * http://localhost:5000/exec/mkdir/my-new-dir-name/
 * 
 * Uses:
 * https://github.com/sintaxi/node-dbox
 * http://expressjs.com/api.html
 * 
 */


var express = require("express");
var app = express();
var router = require("./core/router");
var url = require('url');

/**
 * app init
 */
app.configure(function() {

    app.use(express.bodyParser());

	// start session
	app.use(express.cookieParser());
	app.use(express.cookieSession({ secret: 'plum plum plum'}));

	router.init(app, express);
});

/**
 * CORS middleware
 */
app.use(function(request, res, next) {

	// allow all domains to request the API
	var url_str = request.header('Referer');
	var domain = "*";
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
 * prepare url and call the router
 */
app.use(function(request, response, next){
	console.log('-------------------------------------');
	console.log(request.url);
	var url_parts = url.parse(request.url, true);
	var path = url_parts.path;
	// URL decode path
	path = decodeURIComponent(path.replace(/\+/g, ' '));
	// split to be able to manipulate each folder
	var url_arr = path.split("/");
	// remove the first empty "" from the path
	url_arr.shift(); 
	// remove the api version number
	url_arr.shift(); 
	// get and remove the service name
	var serviceName = url_arr.shift(); 
	try{
		if (serviceName){
			var routed = router.route(serviceName, url_arr, request, response);
			if (!routed){
				console.error("Unknown service "+serviceName);
				next();
			}
		}
		else{
			// happens all the time when looking for the favicon
			//console.error("Unknown service "+serviceName);
			next();
		}
	}
	catch(e){
		console.error("Error loading service "+serviceName+": "+e);
		next();
	}
});

// display the routes for teting
require("./core/display-routes.js").init(app);

// ******* Server "loop"
var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

