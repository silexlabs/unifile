/**
 * Service connector for the dropbox api
 * 
 * Uses:
 * https://github.com/sintaxi/node-dbox
 * 
 */

// config

var config  = require("./config");
var dbox  = require("dbox");
//var dboxapp   = dbox.app({ "app_key": "svr5id53hug36a7", "app_secret": "mpbhr91louaqk6o" })
//var dboxapp   = dbox.app({"root" : "dropbox", "app_key": "rvz6kvs9394dx8a", "app_secret": "b0stxoj0zsxy14m" })

var dboxapp   = dbox.app({"root" : config.root, "app_key": config.app_key, "app_secret": config.app_secret })

// ******* Internal Methods

exports.connect = function (cbk) {
	dboxapp.requesttoken(function(status, request_token){
		cbk({success:true}, request_token);
	});
}
exports.login = function (request_token, cbk) {
	dboxapp.accesstoken(request_token, function(status, access_token){
	  cbk({success:true}, access_token);
	})
}
exports.getClient = function (access_token, cbk) {
	var client = dboxapp.client(access_token)
	  cbk(client);
}
exports.getAccountInfo = function (access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.account(function(status, reply){
			cbk({success:true}, reply);
		})
	})
}


// ******* commands

exports.ls_l = function (path, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.readdir(path, {
			details: true,
			recursive: false
		}, 
		function(status, reply){
			cbk({success:true}, reply);
		})
	});
}
exports.ls_r = function (path, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.readdir(path, {
			details: false,
			recursive: true
		},
		function(status, reply){
			cbk({success:true}, reply);
		})
	});
}
exports.rm = function (path, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.rm(path, function(status, reply){
			cbk({success:true}, reply);
		})
	});
}
exports.mkdir = function (path, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.mkdir(path, function(status, reply){
			cbk({success:true}, reply);
		})
	});
}
exports.cp = function (src, dst, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.cp(src, dst, function(status, reply){
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	});
}
exports.mv = function (src, dst, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.mv(src, dst, function(status, reply){
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	});
}
exports.put = function (path, data, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.put(path, data, function(status, reply){
			if (reply.error)
				cbk({success:false}, reply);
			else
				cbk({success:true}, reply);
		})
	});
}
exports.cat = function (path, access_token, cbk) {
	exports.getClient(access_token, function (client) {
		client.get(path, function(status, reply, metadata){
			if (reply.error)
				cbk({success:false}, reply, reply.toString(), metadata);
			else
				cbk({success:true}, reply, reply.toString(), metadata);
		})
	});
}
