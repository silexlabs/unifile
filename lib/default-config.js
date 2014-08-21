/**
 * route name for unifile api
 */
exports.apiRoot = '/api';

/**
 * session secret
 */
exports.sessionSecret = 'unifile not so secret';

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
  LOGIN_TEMPLATE_PATH: __dirname + '/templates/login-www.jade',
  LOGIN_CSS_PATH: __dirname + '/templates/login.css',
  AUTH_FORM_ROUTE: '/api/v1.0/www-auth',
  AUTH_FORM_SUBMIT_ROUTE: '/api/v1.0/www-auth-submit',
	USERS: {
	}
}
/**
 * FTP service config
 */
exports.ftp =
{
  LOGIN_TEMPLATE_PATH: __dirname + '/templates/login-ftp.jade',
  LOGIN_CSS_PATH: __dirname + '/templates/login.css',
	AUTH_FORM_ROUTE: '/api/v1.0/ftp-auth',
	AUTH_FORM_SUBMIT_ROUTE: '/api/v1.0/ftp-auth-submit'
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
