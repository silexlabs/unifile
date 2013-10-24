/*
 * Unifile, unified access to cloud storage services.
 * https://github.com/silexlabs/unifile/
 *
 * Copyright (c) Silex Labs
 * Unifile is available under the GPL license
 * http://www.silexlabs.org/silex/silex-licensing/
 */
/**
 * About this file
 * Here is the default config object
 */

/**
 * route name for unifile api
 */
exports.apiRoot = "/api";

/**
 * list all services
 */
exports.services = [
	'dropbox',
	'www'
];

/**
 * static folders
 */
exports.staticFolders = [
	// assets
	{
		name: "/unifile-assets",
		path: "../../unifile-assets/"
	}
];
/**
 * www service config (the local server)
 */
exports.www =
{
	root : "../../www",
	auth_form_route: "/api/v1.0/www-auth",
	auth_form_submit_route: "/api/v1.0/www-auth-submit",
	auth_form_warning: "<p style='color: red; '>WARNING: YOUR LOGIN/PASS IS SET TO ADMIN/ADMIN</p>",
	auth_form_html: "<form action='/api/v1.0/www-auth-submit' method='post'>\
	    <div>\
	        <label>Username:</label>\
	        <input type='text' name='username'/>\
	    </div>\
	    <div>\
	        <label>Password:</label>\
	        <input type='password' name='password'/>\
	    </div>\
	    <div>\
	        <input type='submit' value='Log In'/>\
	    </div>\
	</form>",
	users: {
	}
}
/**
 * dropbox app config
 */
exports.dropbox =
{
	root : "dropbox",
	app_key : "ngk5t8312eo4agh",
	app_secret : "7uxqr625pct7zbl"
}
/**
 * available routes on this server
 */
exports.routes = {
	"api/":{
		"v1.0/":{
			"services/":{
				"list/":{}
			},
			"www/":{
				"connect/":{},
				"login/":{},
				"logout/":{},
				"account/":{},
				"exec/":{
					"ls/":{},
					"rm/":{},
					"mkdir/":{},
					"cp/":{},
					"mv/":{},
					"get/":{},
					"put/":{}
				}
			},
			"dropbox/":{
				"connect/":{},
				"login/":{},
				"logout/":{},
				"account/":{},
				"exec/":{
					"ls/":{},
					"rm/":{},
					"mkdir/":{},
					"cp/":{},
					"mv/":{},
					"get/":{},
					"put/":{}
				}
			}
		}
	}
};