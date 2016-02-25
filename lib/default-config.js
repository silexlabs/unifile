var path = require('path');

/**
 * route name for unifile api
 */
exports.apiRoot = '/api';

/**
 * session secret
 */
exports.sessionSecret = 'unifile not so secret';
/**
 * session cookie name
 */
exports.cookieName = 'unifilecookie';

/**
 * list all services
 */
exports.services = [
	'dropbox',
	'www',
  'ftp',
	'open-pages',
	'github'
];

/**
 * static folders
 */
exports.staticFolders = [
  // assets
  {
    name: '/unifile-assets',
    path: path.join(__dirname, '/../unifile-assets/')
  }
];
/**
 * www service config (the local server)
 */
exports.www =
{
  ROOT : path.join(__dirname, '/../www'),
  LOGIN_TEMPLATE_PATH: path.join(__dirname, '/templates/login-www.jade'),
  LOGIN_CSS_PATH: path.join(__dirname, '/templates/login.css'),
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
  LOGIN_TEMPLATE_PATH: path.join(__dirname, '/templates/login-ftp.jade'),
  LOGIN_CSS_PATH: path.join(__dirname, '/templates/login.css'),
  AUTH_FORM_ROUTE: '/api/v1.0/ftp-auth',
  AUTH_FORM_SUBMIT_ROUTE: '/api/v1.0/ftp-auth-submit'
}
/**
 * Open pages
 */
exports.openPages =
{
  ENABLED: false,
  LOGIN_TEMPLATE_PATH: path.join(__dirname, '/templates/login-open-pages.jade'),
  LOGIN_CSS_PATH: path.join(__dirname, '/templates/login.css'),
  AUTH_FORM_ROUTE: '/api/v1.0/open-pages-auth',
  ROOT : path.join(__dirname, '/../open-pages'),
  AUTH_FORM_SUBMIT_ROUTE: '/api/v1.0/open-pages-auth-submit',
  SQLLITE_FILE: path.join(__dirname, '/../open-pages/db.sql'),
  OPEN_PAGES_WEB_ROUTE: '/op', // means that /op/{name}/ is serves the user's folder 'name'
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
 * GitHub config
 */
exports.github = {
  LOGIN_TEMPLATE_PATH: path.join('/templates/login-ftp.jade'),
  LOGIN_CSS_PATH: path.join('/templates/login.css'),
	AUTH_FORM_ROUTE: '/api/v1.0/github-auth',
	client_id: 'b4e46028bf36d871f68d',
	client_secret: 'c39806c4d0906cfeaac932012996a1919475cc78'
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
			},
			'open-pages/':{
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
			'github/':{
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
