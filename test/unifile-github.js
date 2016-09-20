'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const proxyquire = require('proxyquire').noCallThru();

/* eslint-disable complexity */
const requireStub = {
  request: function(opts, callback) {
    const res = {headers: {}};
    const auth = opts.headers ? opts.headers.Authorization : null;
    const endPoint = opts.url.split('/').pop();
    switch (endPoint) {
      case 'access_token':
        switch (opts.body.code) {
          case 'a':
            callback(null, res, {'access_token': 'b'});
            break;
          case 'b':
            // GitHub respond a 404 when something is wrong
            res.statusCode = 404;
            callback(null, res, {error: 'Not Found'});
            break;
          default:
            res.statusCode = 404;
            callback(new Error('BOOM'), res, {error: 'Not Found'});
        }
        break;
      case 'user':
        if(auth.includes('Basic') && auth !== 'Basic bmFtZTpwd2Q=') {
          res.statusCode = 400;
          callback(null, res, '{"error": "Bad Credentials"}');
        } else if(auth.includes('token') && auth === 'token bad_token') {
          res.statusCode = 400;
          callback(null, res, '{"error": "Bad Credentials"}');
        } else
          callback(null, res, '{"name": "a", "login": "a", "num_repos": 1}');
        break;
      case 'repos':
        if(auth !== 'token token') {
          res.statusCode = 400;
          callback(null, res, '{"error": "Bad Credentials"}');
        } else {
          callback(null, res, JSON.stringify([{
            name: 'repo1',
            size: 1,
            updated_at: '2016-09-20T18:15:59Z'
          }, {
            name: 'repo2',
            size: 2,
            updated_at: '2016-09-20T18:16:59Z'
          }]));
        }
        break;
      case 'branches':
        callback(null, res, JSON.stringify([{
          name: 'master',
          commit: {
            url: 'https://api.github.com/repos/login/test/commits/commit1'
          }
        }, {
          name: 'develop',
          commit: {
            url: 'https://api.github.com/repos/login/test/commits/commit2'
          }
        }]));
        break;
      case 'commit1': //falls through
      case 'commit2':
        callback(null, res, JSON.stringify({
          commit: {
            author: {
              date: '2016-09-20T18:35:32Z'
            }
          }
        }));
        break;
    }
  }
};
/* eslint-enable complexity */

const GitHubConnector = proxyquire('../lib/unifile-github.js', requireStub);

describe('GitHub connector', function() {
  describe('constructor', function() {
    it('throws an error if an empty configuration is passed', function() {
      expect(() => new GitHubConnector()).to.throw('Invalid configuration');
    });

    it('throws an error if a required field is missing', function() {
      expect(() => new GitHubConnector({clientId: 'a'})).to.throw('Invalid configuration');
      expect(() => new GitHubConnector({clientSecret: 'a'})).to.throw('Invalid configuration');
    });

    it('returns a new instance with the field properly set without the defaults', function() {
      var gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
      expect(gh).to.be.an.instanceof(GitHubConnector);
      expect(gh.clientId).to.equal('a');
      expect(gh.clientSecret).to.equal('a');
      expect(gh.name).to.equal('github');
      expect(gh.serviceHost).to.equal('github.com');
      expect(gh.oauthCallbackUrl).to.equal('https://github.com/login/oauth');
    });

    it('returns a new instance with defaults overriden if provided', function() {
      var gh = new GitHubConnector({
        clientId: 'a',
        clientSecret: 'a',
        name: 'ghtest',
        serviceHost: 'localhost'
      });
      expect(gh).to.be.an.instanceof(GitHubConnector);
      expect(gh.clientId).to.equal('a');
      expect(gh.clientSecret).to.equal('a');
      expect(gh.name).to.equal('ghtest');
      expect(gh.serviceHost).to.equal('localhost');
      expect(gh.oauthCallbackUrl).to.equal('https://localhost/login/oauth');
    });
  });

  describe('getInfos()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('returns all the required fields', function() {
      const infos = gh.getInfos({});
      expect(infos).to.have.all.keys('name', 'displayName', 'icon', 'description', 'isLoggedIn', 'isOAuth', 'username');
      expect(infos.name).to.be.a('string').and.equal('github');
      expect(infos.displayName).to.be.a('string').and.equal('GitHub');
      expect(infos.icon).to.be.a('string');
      expect(infos.description).to.be.a('string');
      expect(infos.isLoggedIn).to.be.a('boolean').and.is.false;
      expect(infos.isOAuth).to.be.a('boolean').and.is.true;
      expect(infos.username).to.be.a('string').and.equal('n/a');
    });

    it('returns username when logged', function() {
      const infos = gh.getInfos({token: 'a', account: {display_name: 'test'}});
      expect(infos).to.have.property('isLoggedIn', true);
      expect(infos).to.have.property('username', 'test');
    });
  });

  describe('login()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('fails if state is different from the one generated', function() {
      return expect(gh.login({state: 'a'}, {state: 'b'})).to.be.rejectedWith('Invalid request');
    });

    it('fails if the credentials are wrong', function() {
      return expect(gh.login({
        state: 'a',
        clientId: 'a',
        clientSecret: 'a'
      }, {
        state: 'a',
        code: 'b'
      })).to.be.rejectedWith('Unable to get access token');
    });

    it('fails if a network error occured', function() {
      return expect(gh.login({
        state: 'a',
        clientId: 'a',
        clientSecret: 'a'
      }, {
        state: 'a',
        code: 'c'
      })).to.be.rejectedWith('Error while calling GitHub API');
    });

    it('returns an access token', function() {
      const session = {
        state: 'a',
        clientId: 'a',
        clientSecret: 'a'
      };
      return expect(gh.login(session, {
        state: 'a',
        code: 'a'
      })).to.eventually.equal('b')
      .then(() => expect(session).to.have.property('token', 'b'));
    });
  });

  describe('setBasicAuth()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('fails if the credentials are wrong', function() {
      const session = {};
      return expect(gh.setBasicAuth(session, 'name', 'wrong')).to.be.rejectedWith(Error)
      .then(() => expect(session).to.not.have.property('basic'));
    });

    it('returns the username', function() {
      const session = {};
      return expect(gh.setBasicAuth(session, 'name', 'pwd')).to.become('name')
      .then(() => expect(session).to.have.property('basic', 'bmFtZTpwd2Q='));
    });
  });

  describe('setAccessToken()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('fails if the credentials are wrong', function() {
      const session = {};
      return expect(gh.setAccessToken(session, 'bad_token')).to.be.rejectedWith(Error)
      .then(() => expect(session).to.not.have.property('token'));
    });

    it('returns the username', function() {
      const session = {};
      return expect(gh.setAccessToken(session, 'token')).to.become('token')
      .then(() => expect(session).to.have.property('token', 'token'));
    });
  });

  describe('clearAccessToken()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('does not change a thing when not logged', function() {
      expect(gh.clearAccessToken({})).to.be.fulfilled;
    });

    it('clears all authentification', function() {
      const session = {token: 'token', basic: 'basic', account: {}};
      expect(gh.clearAccessToken(session)).to.be.fulfilled
      .then(() => {
        expect(session.token).to.be.null;
        expect(session.basic).to.be.null;
        expect(session.account).to.be.null;
      });
    });
  });

  describe('getAuthorizeURL()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('returns the OAuth authorize URL', function() {
      expect(gh.getAuthorizeURL({})).to.eventually
      .include('https://github.com/login/oauth/authorize?scope=repo,delete_repo&client_id=a&state=');
    });

    it('uses a different state each call', function() {
      let state;
      gh.getAuthorizeURL({})
      .then((url) => state = url.split('=').pop())
      .then(() => gh.getAuthorizeURL({}))
      .then((url) => expect(url.split('=').pop()).to.not.equal(state));
    });
  });

  describe('readdir()', function() {
    let gh;
    beforeEach('Instanciation', function() {
      gh = new GitHubConnector({clientId: 'a', clientSecret: 'a'});
    });

    it('fails if credentials are invalid', function() {
      return expect(gh.readdir({}, '')).to.be.rejectedWith(Error);
    });

    it('returns a list of repositories when path is empty', function() {
      return gh.readdir({token: 'token'}, '')
      .then((repos) => {
        expect(repos.length).to.equal(2);
        expect(repos[0]).to.deep.equal({
          size: 1,
          modified: '2016-09-20T18:15:59.000Z',
          name: 'repo1',
          isDir: true,
          mime: 'application/git-repo'
        });
        expect(repos[1]).to.deep.equal({
          size: 2,
          modified: '2016-09-20T18:16:59.000Z',
          name: 'repo2',
          isDir: true,
          mime: 'application/git-repo'
        });
      });
    });

    it('fails if account is not set and path has one level', function() {
      return expect(gh.readdir({token: 'token'}, 'a')).to.be.rejectedWith('User account login is not set');
    });

    it('returns a list of branch when path has only one level', function() {
      return gh.readdir({token: 'token', account: {login: 'login'}}, 'a');
    });
  });
});
