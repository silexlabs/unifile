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


var router = require("./router");

var express = require("express");
var app = express();
app.use(express.cookieParser());
app.use(express.cookieSession({ secret: 'plum plum plum' }));


// load services

var serviceNamesArr = ["dropbox"];

var services = [];
var idx;
for (idx = 0; idx < serviceNamesArr.length; idx++){
	services[serviceNamesArr[idx]] = require("./services/"+serviceNamesArr[idx]);
}

// prepare url and call the router

app.use(function(request, response, next){
	var url = require('url');
	var url_parts = url.parse(request.url, true);
	var path = url_parts.path;
	// URL decode path
	path = decodeURIComponent(path.replace(/\+/g, ' '));
	// split to be able to manipulate each folder
	var url_arr = path.split("/");
	// remove the first empty "" from the path
	url_arr.shift(); 
	// get and remove the service name
	var serviceName = url_arr.shift(); 
	var service = services[serviceName];
	if (service){
		var routed = router.route(service, url_arr, request, function (reply) {
			response.send(reply)
		});
		if (!routed)
			displayRoutes(request, response);
	}
	else{
		console.error("Unknown service ");
		//next();
		displayRoutes(request, response);
	}
});

app.get('/', function(request, response) {
	displayRoutes(request, response);
});

function displayRoutes(request, response){
	response.send({
		status:{success:false, message:"Nothing here. Returns a list of routes."}, 
		links: serviceNamesArr
	});
}

// ******* Server "loop"

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

