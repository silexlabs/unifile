/** 
 * functions used to display links to help navigate in the routes
 * the data displayed is from the config.js file
 */

/** 
 * load the routes data
 */
var routes = require("../config.js").routes;

/** 
 * init the mechanism used to catch the api routes 
 */
exports.init = function(app){
	init_routes_recursive("", routes, app);
}

/** 
 * parse the routes discribed in routes.json and call add_route
 */
function init_routes_recursive(parentPath, route_obj, app){
	for (var path in route_obj){
		var html_string = display_routes(route_obj[path]);
		if (html_string!=""){
			add_route(parentPath + path, html_string, app);
			init_routes_recursive(parentPath + path, route_obj[path], app);
		}
	}
}
/** 
 * attach a nodejs router event to the given path
 */
function add_route(path, html_string, app){
//	console.log("path "+path);
//	console.log("result = "+html_string);
	app.get(path, function(request, response) {
		response.send(html_string)
	});
}

/**
 * called when the user accesses a path which is not handled by the router
 * @returns a list of links to help navigate in the routes or null if the route is supposed to be handled by the router
 */
function display_routes(route_obj){
	var found = false;
	var reply = "";

	reply += '<html><head><link rel="stylesheet" href="/v1.0/www/exec/get/unifile/style.css" /></head><body>';
	reply += '<a href="https://github.com/lexoyo/unifile"><img style="position: absolute; top: 0; right: 0; border: 0;" src="/v1.0/www/exec/get/unifile/forkme.png"></a>';
	reply += '<ul>';
	reply += '<li class="link up-link"><a href="../">../</a></li>';

	for (var path in route_obj){
		found=true;
		reply += '<li class="link down-link"><a href="./' + path + '">' + path + '</a></li>';
	}
	reply += '</ul></body></html>';

	if (found)
		return reply;
	else 
		return '';
}

