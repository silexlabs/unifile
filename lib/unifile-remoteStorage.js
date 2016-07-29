const Promise = require('bluebird');
const RemoteStorage = require('remotestoragejs');
const request = require('request');

const OAUTH_PATH = '/apps/remotestorage/oauth/';

const NAME = 'remotestorage';

function initModule(){
  console.log('INIT');
  RemoteStorage.defineModule('files', function(privateClient, publicClient){
    console.log('HEllo');

    privateClient.declareType('file', {
      key: 'name',
      type: 'object',
      required: ['name', 'bytes', 'modified', 'is_dir'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Full name of the file, including its path'
        },
        bytes: {
          type: 'number',
          description: 'Size of the file in bytes'
        },
        modified: {
          type: 'date',
          description: 'Date of the last modification of this file'
        },
        is_dir: {
          type: 'boolean',
          description: 'True if it is a folder'
        }
      }
    });

    return {
      exports : {
        test: function(){
          console.log('this is a test');
        },
        list: function(path){
          return privateClient.getListing(path);
        }
      }
    }
  });
}

function get(url, path, token){
  let opts = {
    url: url + '/' + path,
    headers: {
      'Authorization' : 'Bearer ' + token
    }
  };
  return new Promise(function(resolve, reject){
    request.get(opts, function(err, res, body){
      console.log(res.statusCode, res.headers, body);
      resolve(body);
    })
  });
}

function put(url, path, content, token){
  let opts = {
    url: url + '/' + path,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'text/plain; charset=UTF-8'
    },
    body: content
  };
  return new Promise(function(resolve, reject){
    request.put(opts, function(err, res, body){
      console.log(res.statusCode, res.headers, body);
      resolve(body);
    })
  });
}

function del(url, path, token){
  let opts = {
    url: url + '/' + path,
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };
  return new Promise(function(resolve, reject){
    request.del(opts, function(err, res, body){
      console.log(res.statusCode, res.headers, body);
      resolve(body);
    })
  });
}

function getStorage(session){
  var storage = new RemoteStorage({logging: false});
  initModule();
  storage.access.claim('files', 'rw');
  storage.remote.configure({
    userAddress: session.userAddress,
    href: session.infos.href,
    storageApi: session.infos.storageType,
    properties: session.infos.properties,
    token: session.token
  });
  return storage;
}

class RemoteStorageConnector {
  constructor(config){
    this.config = config;
    this.name = NAME;
  }

  getAuthorizeURL(session){
    // TODO use https://github.com/e14n/webfinger
    return RemoteStorage.Discover(session.userAddress)
    .then(obj => {
      session.infos = obj;
      let query = 'redirect_uri=' + this.config.redirectUri
      + '&client_id=Unifile'
        + '&scope=*:rw'
      + '&response_type=token';
      if(obj.authURL.indexOf('?') > -1) query = '&' + query;
      else query = '?' + query;

      return obj.authURL + query;
    });
  }

  login(session, loginInfos){
    session.token = loginInfos.token;
    return Promise.resolve(session.token);
  }

  readdir(session, path){
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(!path.endsWith('/')){
      return Promise.reject('Folder path must end with a /. If you want to see a file content, call readFile() instead');
    }
    else{
      let storage = getStorage(session);
      return get(storage.remote.href, path, session.token);
    }
  }

  mkdir(session, path){
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(!path.endsWith('/')){
      return Promise.reject('Folder path must end with a /. If you want to create a file, call writeFile() instead');
    }
    else{
      let storage = getStorage(session);
      return put(storage.remote.href, path + '/.keep', '', session.token);
    }
  }

  writeFile(session, path, content){
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(path.endsWith('/')){
      return Promise.reject('File path cannot end with a /. If you want to create a folder, call mkdir() instead');
    }
    else{
      let storage = getStorage(session);
      return put(storage.remote.href, path, content, session.token);
    }
  }

  readFile(session, path){
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(path.endsWith('/')){
      return Promise.reject('File path cannot end with a /. If you want to see a folder listing, call readdir() instead');
    }
    else{
      let storage = getStorage(session);
      return get(storage.remote.href, path, session.token);
    }
  }

  unlink(session, path){
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(path.endsWith('/')){
      return Promise.reject('File path cannot end with a /. If you want to delete a folder, call rmdir() instead');
    }
    else{
      let storage = getStorage(session);
      return del(storage.remote.href, path, session.token);
    }
  }

  rmdir(session, path){
    if(!session.token)
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    else if(!path.endsWith('/')){
      return Promise.reject('Folder path must end with a /. If you want to delete a file, call unlink() instead');
    }
    else{
      let storage = getStorage(session);
      return del(storage.remote.href, path + '/.keep', session.token);
    }
  }
}

module.exports = RemoteStorageConnector;
