'use strict';

var url = require('url');

var request = require('request');
var Promise = require('bluebird');

const NAME = 'GitHub';
const GH_OAUTH_URL = 'https://github.com/login/oauth';
const APP_PERMISSION = 'scope=repo,delete_repo';

/*
 * Remove first '/', split the path and remove empty tokens
 * @param {String} path - Path to split
 * @return {Array<String>} an array with path levels as elements
 */
function getPathTokens(path) {
  return path.substr(1).split('/').filter((s) => s !== '');
}

/**
 * Handle GitHub pagination
 * @param  {Object} reqOptions - Options to pass to the request. Url will be overidden
 * @param  {string} link - Link header
 * @param  {Object[]} memo - Aggregator of result
 * @return {Promise} a Promise of aggregated result
 */
function paginate(reqOptions, link, memo) {
  var links = link.split(/,\s*/);
  var matches;
  links.some(function(link) {
    matches = link.trim().match(/<(.+)>;\s*rel="next"/);
    return matches !== null;
  });
  // End of pagination
  if(!matches){
    return Promise.resolve(memo);
  }
  return new Promise(function(resolve, reject) {
    reqOptions.url = matches[1];
    request(reqOptions, function(err, res, body) {
      memo = memo.concat(memo, JSON.parse(body));
      paginate(reqOptions, res.headers.link, memo).then(resolve);
    });
  });
}

/**
 * Make a call to the GitHub API
 * @param {string] token - Access token to the API
 * @param {string} path - End point path
 * @param {Object} data - Data to pass. Convert to querystring if method is GET or to the request body
 * @param {string} method - HTTP verb to use
 * @return {Promise} a Promise of the result send by server
 */
function callAPI(token, path, data, method) {
  var reqOptions = {
    url: 'https://api.github.com' + path,
      method: method,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': 'token ' +  token,
        'User-Agent': 'Unifile'
      }
  };
  method === 'GET' ? reqOptions.qs = data : reqOptions.body = JSON.stringify(data);
  //console.log('Calling', reqOptions.url, 'with', data);
  return new Promise(function(resolve, reject) {
    request(reqOptions, function (err, res, body) {
      if (err) {
        return reject(err);
      }
      if (res.statusCode >= 400) {
        var error = new Error(JSON.parse(body).message);
        error.statusCode = res.statusCode;
        return reject(error);
      }
      try {
        var result = res.statusCode !== 204 ? JSON.parse(body) : null;
        if(res.headers.hasOwnProperty('link')){
          paginate(reqOptions, res.headers.link, result).then(resolve);
        }
        else resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

class GitHubConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
    this.isConnected = false;
    this.session = new Map();
  }

  login(loginInfos){
    if(loginInfos.state !== this.config.state) return Promise.reject('Invalid request (cross-site request)');

    this.isConnected = true;
    return new Promise((resolve, reject) => {
      request({
        url: GH_OAUTH_URL + '/access_token',
        method: 'POST',
        body: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: loginInfos.code,
          state: this.config.state
        },
        json: true
      }, function (err, response, body) {
        if (err) return reject('Error while calling GitHub API. ' + err);

        return resolve(body.access_token);
      });
    })
    .then((token) => {
      this.session.token = token;
    })
    .then(() => {
      return callAPI(this.session.token, '/user', null, 'GET');
    })
    .then((result) => {
      this.session.account = {
       display_name: result.name,
       login: result.login,
       num_repos: result.public_repos
      };
    });
  }

  getAuthorizeURL() {
    return GH_OAUTH_URL + '/authorize?' + APP_PERMISSION + '&client_id=' + this.config.clientId + '&state=' + this.config.state;
  }

  ls(path){
    if (!this.isConnected){
      return Promise.reject('User not logged in yet. You need to call the login() first.');
    }
    else{
      var splitPath = getPathTokens(path);
      var resultPromise;
      switch (splitPath.length) {
        case 0: // List repos
          resultPromise = callAPI(this.session.token, '/user/repos', {affiliation: 'owner'}, 'GET')
          .then(function (res) {
            return res.map(function(item) {
              return {
                bytes: item.size,
                modified: new Date(item.updated_at).toISOString(),
                name: item.name,
                is_dir: true
              };
            });
          });
          break;
        case 1: // List all branches
          var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0] + '/branches';
          resultPromise = callAPI(this.session.token, apiPath, null, 'GET')
          .bind(this)
          .then(function (res) {
            return Promise.map(res, function(item) {
              return callAPI(this.session.token, url.parse(item.commit.url).path, null, 'GET')
              .then(function(result) {
                return result.commit.author.date;
              })
              .then(function(date) {
                return {
                  bytes: 'N/A',
                  modified: new Date(date).toISOString(),
                  name: item.name,
                  is_dir: true
                };
              });
            }.bind(this));
          });
          break;
        default: // List files of one branch
          var apiPath = '/repos/' + this.session.account.login + '/' + splitPath[0];
          var filePath = splitPath.slice(2).join('/');
          var reqData = {
            ref: splitPath[1]
          };
          resultPromise = callAPI(this.session.token, apiPath + '/contents/' + filePath, reqData, 'GET')
          .then(function(res) {
            return Promise.map(res, function(item) {
              return callAPI(this.session.token, apiPath + '/commits', {path: item.path, sha: splitPath[1]}, 'GET')
              .then(function(result) {
                return result[0].commit.author.date;
              })
              .then(function(date) {
                return {
                  bytes: item.size,
                  modified: new Date(date).toISOString(),
                  name: item.name,
                  is_dir: item.type === 'dir'
                };
              });
            });
          });
      }

      return resultPromise;
    }
  }
}

module.exports = GitHubConnector;
