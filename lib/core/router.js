var services = {};
// polyfills in the .normalize() method being called on the strings. This method is part of ECMA6, and in future versions of Node you will not need to load unorm at all
// source: http://stackoverflow.com/questions/21208086/nodejs-compare-unicode-file-names
var unorm = require('unorm');
var fs = require('fs');

/**
 * init the service global vars
 */
exports.init = function (app, express, options) {
	for(var serviceIdx in options.services){
		var serviceName = options.services[serviceIdx];
		services[serviceName] = require('../services/'+serviceName+'.js'),
		services[serviceName].init(app, express, options);
	}
}


/**
 * routes the call to a given service with the given params
 */
exports.route = function (serviceName, url_arr, request, response, next, cbk) {
	// URL to list available services
	if (serviceName==='services'){
		var res = [];
		for(var serviceName in services){
			var service = services[serviceName];
			var info = service.getInfo(request);
			if (info && info.visible === true){
				res.push(info);
			}
		}
		cbk(response, {"success": true}, res);
		return true;
	}
	else{
		var service = services[serviceName];
		if (service){
			if(url_arr.length > 0 && url_arr[0] !== ""){
				switch (url_arr[0]){
					case "exec":
						if (url_arr.length > 2){
							// remove the "exec" from the path
							url_arr.shift();
							// retrieve command
							var command = url_arr[0];
							// remove the command from the path
							url_arr.shift();
							// retrieve the path - do not take get params (what is after the "?")
							var path = '/' + url_arr.join('/').split('?')[0];
							// executes the command
							return exec(service, command, path, request, response, next, cbk);
						}
						break;
					case "connect":
						service.connect(request, response, next, function  (status) {
							cbk(response, status);
						});
						return true;
          case "login":
            service.login(request, response, next, function  (status) {
              cbk(response, status, status);
            });
            return true;
					case "logout":
						service.logout(request, response, next, function  (status) {
							cbk(response, status, status);
						});
						return true;
					case "account":
						service.getAccountInfo(request, response, next,
							function(status, reply){
								cbk(response, status, reply);
							})
						return true;
				}
				console.error("Unknown route "+url_arr[0]);
				return false;
			}
		}
	}
	return false;
}

function exec (service, command, path, request, response, next, cbk) {
	switch (command){
		case "ls":
			service.ls(path.normalize(),
				request, response, next,
				function(status, reply){
					cbk(response, status, reply);
				});
			return true;
		case "rm":
			if (!path || path === "" || path === "/") break;
			service.rm(path.normalize(),
				request, response, next,
				function(status){
					cbk(response, status, status);
				});
			return true;
		case "mkdir":
			service.mkdir(path.normalize(),
				request, response, next,
				function(status, reply){
					cbk(response, status, reply);
				})
			return true;
		case "get":
			service.get(path.normalize(),
				request, response, next,
				function(status, text_content, mime_type, path){
					if (text_content || path){
						cbk(response, status, text_content, mime_type, path);
					}
					else if (status){
						cbk(response, status, status);
					}
				})
			return true;
		case "put":
      // upload with file data in data
      if (request.files && request.files.data){
        if (request.files.data.path){
          // default name for the file = the uploaded file name
          if (path.charAt(path.length-1) === '/'){
            path += request.files.data.name;
          }
          // 1 file upload
          fs.readFile(request.files.data.path, function (err, data) {
            service.put(path.normalize(), data,
              request, response, next,
              function(status, reply){
                cbk(response, status, reply);
              });
          });
        }
        else{
          // multiple files upload
          multipleUpload(path.normalize(), request.files.data, service, request, response, next, function(status, uploadedFiles){
            cbk(response, status, uploadedFiles);
          });
        }
      }
      else{
        // define local doPut method
        var doPut = function (data) {
          if(!data || !data.length){
            console.error('File upload failed: no data provided in GET nor POST');
            cbk(response, {success:false, message:'File upload failed: no data provided in GET nor POST.'});
          }
          else {
            // upload success
            service.put(path.normalize(), data,
              request, response, next,
              function(status, reply){
                cbk(response, status, reply);
              })
          }
        }
        var data;
        // file data in POST
        if (request.body && request.body.data){
          data = request.body.data;
          doPut(data);
        }
        else{
          var path_arr = path.split(":");
          path = path_arr[0];
          data = path_arr[1];
          if (data && data !== ''){
            // file data in GET
            doPut(data);
          }
          else{
            console.error('File upload failed: no data provided in GET nor POST.');
            cbk(response, {success:false, message:'File upload failed: no data provided in GET nor POST.'});
          }
        }
			}
			return true;
		case "cp":
			var path_arr = path.split(":");
			var src = path_arr[0];
			var dest = path_arr[1];
			service.cp(src.normalize(), dest.normalize(),
				request, response, next,
				function(status, reply){
					cbk(response, status, reply);
				})
			return true;
		case "mv":
			var path_arr = path.split(":");
			var src = path_arr[0];
			var dest = path_arr[1];
			service.mv(src.normalize(), dest.normalize(),
				request, response, next,
				function(status, reply){
					cbk(response, status, reply);
				})
			return true;
	}
	cbk(response, {success:false, message:'Nothing here ('+service+', '+command+', '+path+'). Returns a list of routes.'},
		['ls', 'rm', 'mkdir', 'get', 'put', 'cp', 'mv']);
	return false;
}
function multipleUpload (dstPath, files, service, request, response, next, cbk, uploadedFiles, lastStatus) {
	if (!uploadedFiles) uploadedFiles = [];
	if (!lastStatus) lastStatus = {success: true};

	if (files.length > 0){
		var file = files.shift();
		fs.readFile(file.path, function (err, data) {
			service.put(dstPath+file.name, data,
				request, response, next,
				function(status, reply){
					lastStatus = status;
					uploadedFiles.push({
						path:dstPath+file.name,
						status:status
					});
					if (status && status.success === true){
						multipleUpload(dstPath, files, service, request, response, next, cbk, uploadedFiles);
					}
					else{
						cbk(status, uploadedFiles);
						lastStatus = {success: true};
					}
				});
		});
	}
	else{
		cbk(lastStatus, uploadedFiles);
	}
}

