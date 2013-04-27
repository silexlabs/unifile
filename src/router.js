

var service = require("./dropbox");

exports.route = function (url_arr, request, cbk) {

	if(url_arr.length > 0){
		switch (url_arr[0]){
			// commands
			case "exec":
				if (url_arr.length > 1){
					// remove the "exec" from the path
					url_arr.shift(); 
					// retrieve command
					var command = url_arr[0];
					console.log("command: "+command);
					// remove the command from the path
					url_arr.shift(); 
					// retrieve the path
					var path = "/" + url_arr.join("/");
					// executes the command
					return exec(command, path, request, cbk);
				}
			case "connect":
				if (request.session.request_token){
					cbk({status:{success:true, message:"Allready connected, <a href='../login/'>continue here</a>. ."}});
				}
				else service.connect(function  (status, request_token) {	
					request.session.request_token = request_token;
					cbk({status:status, data:request_token.authorize_url});
				});
				return true;
			case "login":
				if (request.session.access_token){
					cbk({status:{success:true, message:"Allready logged in, <a href='../account/'>continue here</a>. Or <a href='../logout/'>logout</a>."}});
				}
				else service.login(request.session.request_token, function  (status, access_token) {
					console.dir(access_token);
					request.session.access_token = access_token;
					cbk({status:status});
				});
				return true;
			case "logout":
				if (request.session.request_token 
					|| request.session.access_token
				){
					request.session.request_token = undefined;
					request.session.access_token = undefined;
					cbk({status:{success:true, message:"Now logged out, <a href='../connect/'>continue here</a>."}});
				}
				else{
					cbk({status:{success:true, message:"Was not logged in. <a href='../connect/'>continue here</a>."}});
				}
				return true;
			case "account":
				if (request.session.request_token 
					&& request.session.access_token
				){
					service.getAccountInfo(request.session.access_token, 
						function(status, reply){
							console.log("account : "+status);
							console.dir(reply);
							cbk({status:status, data:reply});
						})
					return true;
				}
				break;
		}

	}
	return false;
}

function exec (command, path, request, cbk) {
	switch (command){
		case "ls-l":
			service.ls_l(path, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				});
			return true;
		case "ls-r":
			service.ls_r(path, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "rm":
			if (!path || path == "" || path == "/") break;
			service.rm(path, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				});
			return true;
		case "mkdir":
			service.mkdir(path, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
	}
	return false;
}


