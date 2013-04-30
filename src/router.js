

exports.route = function (service, url_arr, request, cbk) {
	console.log("route service="+service+", url_arr="+url_arr+", request="+request);
	if (service){
		console.log("route "+url_arr[0]+" - "+url_arr.length);
		if(url_arr.length > 0 && url_arr[0] != ""){
			switch (url_arr[0]){
				case "exec":
					if (url_arr.length > 2){
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
						console.log("call exec service "+service+", command "+command+", path "+path);
						return exec(service, command, path, request, cbk);
					}
				case "connect":
					service.connect(request, function  (status, authorize_url) {	
						cbk({status:status, authorize_url:authorize_url});
					});
					return true;
				case "login":
					service.login(request, function  (status) {
						cbk({status:status});
					});
					return true;
				case "logout":
					service.logout(request, function  (status) {
						cbk({status:status});
					});
					return true;
				case "account":
					service.getAccountInfo(request, 
						function(status, reply){
							console.log("account : "+status);
							console.dir(reply);
							cbk({status:status, data:reply});
						})
					return true;
			}
			console.error("Unknown route "+url_arr[0]);
			return false;
		}
		else{
			console.log("Nothing here. Returns a list of routes.");
			cbk({
				status:{success:false, message:"Nothing here. Returns a list of routes."}, 
				links: ["connect", "login", "logout", "account", "exec"]
			});
		}
	}
	return false;
}

function exec (service, command, path, request, cbk) {
	console.log("exec: "+command+", "+path);
	switch (command){
		case "ls-l":
			service.ls_l(path, 
				request, 
				function(status, reply){
					cbk({status:status, data:reply});
				});
			return true;
		case "ls-r":
			service.ls_r(path, 
				request, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "rm":
			if (!path || path == "" || path == "/") break;
			service.rm(path, 
				request, 
				function(status, reply){
					cbk({status:status, data:reply});
				});
			return true;
		case "mkdir":
			service.mkdir(path, 
				request, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "get":
			service.get(path, 
				request, 
				function(status, text_content, metadata){
					cbk({status:status, metadata:metadata, data:text_content, raw:raw});
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
			service.put(path, data, 
				request, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "cp":
			var path_arr = path.split(":");
			var src = path_arr[0];
			var dest = path_arr[1];
			service.cp(src, dest, 
				request, 
				function(status, reply){
					cbk({status:status, data:reply});
				})
			return true;
		case "mv":
			var path_arr = path.split(":");
			var src = path_arr[0];
			var dest = path_arr[1];
			service.cp(src, dest, 
				request, 
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


