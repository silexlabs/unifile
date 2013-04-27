/**
 * Test of a node service to handle dropbox interactions
 * 
 * Status:
 * It is able to connect, then the user accepts the app, then login and get account info
 * 
 * Next step: 
 * Output json and handle errors
 * Manipulate files
 * Make a unified services for other cloud storage libs
 * 
 * Test:
 * start here http://localhost:5000/ 
 * and follow the links...
 * http://localhost:5000/connect/ 
 * http://localhost:5000/login/
 * http://localhost:5000/logout/
 * http://localhost:5000/account/
 * http://localhost:5000/exec/ls/
 * http://localhost:5000/exec/mkdir/my-new-dir-name/
 * 
 * Uses:
 * https://github.com/sintaxi/node-dbox
 * http://expressjs.com/api.html
 * 
 */

// config

var config  = require("./config");
var dbox  = require("dbox");
//var dboxapp   = dbox.app({ "app_key": "svr5id53hug36a7", "app_secret": "mpbhr91louaqk6o" })
//var dboxapp   = dbox.app({"root" : "dropbox", "app_key": "rvz6kvs9394dx8a", "app_secret": "b0stxoj0zsxy14m" })

var dboxapp   = dbox.app({"root" : config.root, "app_key": config.app_key, "app_secret": config.app_secret })

// ******* Internal Methods

function connect (dboxapp, cbk) {
	dboxapp.requesttoken(function(status, request_token){
	  	console.dir(request_token)
		cbk(request_token);
	});
}
function login (request_token, cbk) {
	dboxapp.accesstoken(request_token, function(status, access_token){
	  console.log(status)
	  console.dir(access_token)
	  cbk(access_token);
	})
}
function getClient (access_token, cbk) {
	var client = dboxapp.client(access_token)
	  console.log("client: "+client)
	  cbk(client);
}

// ******* Rooter and exposed services

var express = require("express");
var app = express();

app.use(express.cookieParser());

app.get('/', function(request, response) {
	response.send("Welcome, <a href='../connect/'>start here</a>.");
});

app.get('/connect/', function(request, response) {
	console.dir(request.cookies.request_token);
	if (request.cookies.request_token) 
		response.send("Allready connected, <a href='../login/'>continue here</a>.");
	else connect(dboxapp, function (request_token) {
	  response.cookie("request_token", request_token);
	  response.send("Now connected, visit <a href='"+request_token.authorize_url+"'>"+request_token.authorize_url+"</a><br />And then <a href='../login/'>continue here</a>.");
	});
});

app.get('/login/', function(request, response){
	console.dir(request.cookies.request_token);
	if (request.cookies.access_token){
		response.send("Allready logged in, <a href='../account/display_name/'>continue here</a>. Or <a href='../logout/'>logout</a>.");
	}
	else login(request.cookies.request_token, function  (access_token) {	
		response.cookie("access_token", access_token);
		response.send("Now logged in, <a href='../account/display_name/'>continue here</a>. Or <a href='../logout/'>logout</a>.");
	});
});

app.get('/logout/', function(request, response){
	console.dir(request.cookies.request_token);
	console.dir(request.cookies.access_token);
	if (request.cookies.request_token 
		|| request.cookies.access_token
	){
		response.clearCookie("request_token");
		response.clearCookie("access_token");
		response.send("Now logged out, <a href='../connect/'>continue here</a>.");
	}
	else{
		response.send("Was not logged in. <a href='../connect/'>continue here</a>.");
	}
});

app.get('/account/', function(request, response){
	getClient(request.cookies.access_token, function (client) {
		client.account(function(status, reply){
			console.log("account : "+status);
			console.dir(reply);
			response.send(reply);
		})
	})
});

app.use(function(request, response, next){
	var url = require('url');
	var url_parts = url.parse(request.url, true);
	var url_arr = url_parts.path.split("/");
	// remove the first empty "" from the path
	url_arr.shift(); 
	console.log("get url "+url_arr);
	// check that it is an exec command
	if (url_arr.length > 2 && url_arr[0]=="exec"){
		// remove the "exec" from the path
		url_arr.shift(); 
		// retrieve command
		var command = url_arr[0];
		console.log("command: "+command);
		// remove the command from the path
		url_arr.shift(); 
		// retrieve the path
		var path = "/" + url_arr.join("/");
		console.log("path="+path);
		switch (command){
			case "ls-l":
				getClient(request.cookies.access_token, function (client) {
					client.readdir(path, {
							details: true,
							recursive: false
						},
						function(status, reply){
						    console.log(status)
						    console.log(reply)
							response.send(reply);
						})
					});
				return;
			case "ls-r":
				getClient(request.cookies.access_token, function (client) {
					client.readdir(path, {
							details: false,
							recursive: true
						},
						function(status, reply){
						    console.log(status)
						    console.log(reply)
							response.send(reply);
						})
					});
				return;
			case "rm":
				if (!path || path == "" || path == "/") break;
				getClient(request.cookies.access_token, function (client) {
					client.rm(path, function(status, reply){
					    console.log(status)
					    console.log(reply)
						response.send(reply);
					})
				})
				return;
			case "mkdir":
				getClient(request.cookies.access_token, function (client) {
					client.mkdir(path, function(status, reply){
					    console.log(status)
					    console.log(reply)
						response.send(reply);
					})
				})
				return;
		}
	}
	next();
});

// ******* Server "loop"

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

