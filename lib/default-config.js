/**
 * route name for unifile api
 */
exports.apiRoot = '/api';

/**
 * list all services
 */
exports.services = [
	'dropbox',
	'www',
	'ftp'
];

/**
 * static folders
 */
exports.staticFolders = [
	// assets
	{
		name: '/unifile-assets',
		path: __dirname + '../../unifile-assets/'
	}
];
/**
 * www service config (the local server)
 */
exports.www =
{
	ROOT : __dirname + '../../www',
	AUTH_FORM_ROUTE: '/api/v1.0/www-auth',
	AUTH_FORM_SUBMIT_ROUTE: '/api/v1.0/www-auth-submit',
	AUTH_FORM_WARNING: "<p style='color: red; '>WARNING: YOUR LOGIN/PASS IS SET TO ADMIN/ADMIN</p>",

	AUTH_FORM_HEAD_HTML: '',
	AUTH_FORM_BODY_HTML: '<form action="/api/v1.0/www-auth-submit" method="post">\
	    <div>\
	        <label>Username:</label>\
	        <input type="text" name="username"/>\
	    </div>\
	    <div>\
	        <label>Password:</label>\
	        <input type="password" name="password"/>\
	    </div>\
	    <div>\
	        <input type="submit" value="Log In"/>\
	    </div>\
	</form>',
	AUTH_SUCCESS_FORM_HEAD_HTML: '<script type="text/javascript">window.onload=function(){window.close();};</script>',
	AUTH_SUCCESS_FORM_BODY_HTML: '<p>close this window please</p>',
	AUTH_ERROR_FORM_HEAD_HTML: '',
	AUTH_ERROR_FORM_BODY_HTML: '<p style="color: red;">Wrong login or password for user $username</p>',

	USERS: {
	}
}
/**
 * FTP service config
 */
exports.ftp =
{
	AUTH_FORM_ROUTE: '/api/v1.0/ftp-auth',
	AUTH_FORM_SUBMIT_ROUTE: '/api/v1.0/ftp-auth-submit',
	AUTH_FORM_WARNING: "<p style='color: red; '>WARNING: YOUR LOGIN/PASS IS SET TO ADMIN/ADMIN</p>",

	AUTH_FORM_HEAD_HTML: '',
	AUTH_FORM_BODY_HTML: '<form action="/api/v1.0/ftp-auth-submit" method="post">\
	    <div>\
	        <label>Host:</label>\
	        <input type="text" name="host"/>\
	    </div>\
	    <div>\
	        <label>Port:</label>\
	        <input type="text" name="port" value="21" />\
	    </div>\
	    <div>\
	        <label>Username:</label>\
	        <input type="text" name="username"/>\
	    </div>\
	    <div>\
	        <label>Password:</label>\
	        <input type="password" name="password"/>\
	    </div>\
	    <div>\
	        <input type="submit" value="Log In"/>\
	    </div>\
	</form>',
	AUTH_SUCCESS_FORM_HEAD_HTML: '<script type="text/javascript">window.onload=function(){window.close();};</script>',
	AUTH_SUCCESS_FORM_BODY_HTML: '<p>close this window please</p>',
	AUTH_ERROR_FORM_HEAD_HTML: '',
	AUTH_ERROR_FORM_BODY_HTML: '<p style="color: red;">Wrong login or password for user $username on $host</p>',
}
/**
 * dropbox app config
 */
exports.dropbox =
{
	root : 'dropbox',
	app_key : 'ngk5t8312eo4agh',
	app_secret : '7uxqr625pct7zbl'
}
/**
 * available routes on this server
 */
exports.routes = {
	'api/':{
		'v1.0/':{
			'services/':{
				'list/':{}
			},
			'www/':{
				'connect/':{},
				'login/':{},
				'logout/':{},
				'account/':{},
				'exec/':{
					'ls/':{},
					'rm/':{},
					'mkdir/':{},
					'cp/':{},
					'mv/':{},
					'get/':{},
					'put/':{}
				}
			},
			'dropbox/':{
				'connect/':{},
				'login/':{},
				'logout/':{},
				'account/':{},
				'exec/':{
					'ls/':{},
					'rm/':{},
					'mkdir/':{},
					'cp/':{},
					'mv/':{},
					'get/':{},
					'put/':{}
				}
			},
			'ftp/':{
				'connect/':{},
				'login/':{},
				'logout/':{},
				'account/':{},
				'exec/':{
					'ls/':{},
					'rm/':{},
					'mkdir/':{},
					'cp/':{},
					'mv/':{},
					'get/':{},
					'put/':{}
				}
			}
		}
	}
};
