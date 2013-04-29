

exports.route = function (service, url_arr, request, cbk) {
	if (service){
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
						return exec(service, command, path, request, cbk);
					}
				case "connect":
					if (request.session.request_token){
						cbk({status:{success:true, message:"Allready connected."}});
					}
					else service.connect(function  (status, request_token) {	
						request.session.request_token = request_token;
						cbk({status:status, data:request_token.authorize_url});
					});
					return true;
				case "login":
					if (request.session.access_token){
						cbk({status:{success:true, message:"Allready logged in."}});
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
						cbk({status:{success:true, message:"Now logged out."}});
					}
					else{
						cbk({status:{success:true, message:"Was not logged in."}});
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
		else{
			cbk({
				status:{success:false, message:"Nothing here. Returns a list of routes."}, 
				links: ["connect", "login", "logout", "account", "exec"]
			});
		}
	}
	return false;
}

function exec (service, command, path, request, cbk) {
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
		case "get":
			service.get(path, request.session.access_token, 
				function(status, raw, text_content, metadata){
					cbk({status:status, raw:raw, data:text_content, metadata:metadata});
				})
			return true;
		case "put":
			var data;
			if (request.body && request.body.data) data = request.body.data;
			else{
				var path_arr = path.split(":");
				path = path_arr[0];
				data = path_arr[1];
			}
			service.put(path, data, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "cp":
			var path_arr = path.split(":");
			var src = path_arr[0];
			var dest = path_arr[1];
			service.cp(src, dest, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "mv":
			var path_arr = path.split(":");
			var src = path_arr[0];
			var dest = path_arr[1];
			service.cp(src, dest, request.session.access_token, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
	}
	cbk({
		status:{success:false, message:"Nothing here. Returns a list of routes."}, 
		links: ["ls-l", "ls-r", "rm", "mkdir", "get", "put", "cp", "mv"]
	});
	return false;
}


