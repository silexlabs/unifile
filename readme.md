#Unifile, unified access to cloud storage services.

[![Build Status](https://travis-ci.org/silexlabs/unifile.png?branch=master)](https://travis-ci.org/silexlabs/unifile)

Express middleware to provide web services for accessing cloud storage services with a common API.

> [Here is the API online documentation with code samples in Javascript, node.js, python...](http://docs.unifile.apiary.io/)

Currently supported services

* FTP
* Dropbox
* GitHub: use git as a cloud with repository and branches as folder
* local web server: auth and browse a given folder on the server where unifile is running
* self hosting mode (we call it "open pages"): auth with [Mozilla persona](https://www.mozilla.org/en-US/persona/), choose a name and brose a folder on the server where unifile is installed and which is served as `http(s)://the-unifile-server.com/chosen-name/` - this is an experimental feature which still has to be fine tuned
* extend unifile: see instructions bellow to add a service

Example

    GET    /api/v1.0/dropbox/exec/ls/path/to/folder/                 list a directory of the loggedin user

#Motivation

In 2013, team has developed the v2 of [Silex](http://www.silex.me/), free and open source website builder for designers. Since Silex is a web app, running in the browser, we faced a choice: either we make people download and install Silex, or we host it in the cloud. But Silex Labs non profit organization can not afford paying hosting for our users.

So we have decided that Silex would edit the user's files on the user's Dropbox. It is not acceptable for a free project to force people to store their data on a service such as Dropbox, so we decided to make it an option. We have added the ability for Silex to edit files on the server on which it is installed. And then other services came to our minds.

We hope that other communities will benefit this way to use their cloud services before they install the web app locally.

#How to install

With node installed ([download](http://nodejs.org/download)), install unifile in your project

    $ npm install unifile

Then write a small node.js server like this and name it ```server.js```

    // node modules
    var unifile = require('unifile');
    var express = require('express');
    var bodyParser = require('body-parser');
    var cookieParser = require('cookie-parser');
    var session = require('express-session');
    var multipart = require('connect-multiparty');

    // init express
    var app = express();

    // config
    var options = unifile.defaultConfig;

    // parse data for file upload
    app.use(options.apiRoot, multipart({limit: '100mb'}));

    // parse data for post and get requests
    app.use(options.apiRoot, bodyParser.urlencoded({
        extended: true,
        limit: '10mb'
    }));
    app.use(options.apiRoot, bodyParser.json({limit: '10mb'}));
    app.use(options.apiRoot, cookieParser());

    // session management
    app.use(options.apiRoot, session({
        secret: options.sessionSecret,
        resave: false,
        saveUninitialized: false
    }));

    // use unifile as a middleware
    app.use(options.apiRoot, unifile.middleware(express, app, options));

    // server 'loop'
    app.listen(6805); // 6805 is the date of sexual revolution started in paris france 8-)

Save this as ```server.js``` and start it with

    $ node server.js

Then start making calls with wget or your browser. For example...

    http://localhost:6805/api/v1.0/services/list/

... will list the available services:

    [
        {
            "name": "dropbox",
            "display_name": "Dropbox",
            "description": "Access files from your Dropbox.",
            "isLoggedIn": true,
            "isConnected": true,
            "user": {
                "display_name": "Alex Hoyau",
                "quota_info": {
                    "available": 5234491392,
                    "used": 4528634951
                }
            }
        },
        {
            "name": "ftp",
            "display_name": "FTP",
            "description": "Access files through FTP.",
            "isLoggedIn": false,
            "isConnected": false
            "user": {
                "display_name": "test",
            }
        },
        {
            "name": "www",
            "display_name": "Web server",
            "description": "Access files on the server where unifile is running.",
            "isLoggedIn": false,
            "isConnected": false
            "user": {
                "display_name": "admin",
            }
        }
    ]

#API calls

Let's take the example of the Dropbox service

Connect to the service

Basic login and such

    GET   /api/v1.0/dropbox/connect/       returns an URL, which you will open and authorize unifile to access the service (this is an oauth2 authorization mechanism)
    GET   /api/v1.0/dropbox/login/          now your have access to the service

    GET   /api/v1.0/dropbox/account/        Get your account info, with your display_name at least
    GET   /api/v1.0/dropbox/logout/         Log out from the service (connect and login will be required)

Execute commands

    GET    /api/v1.0/dropbox/exec/ls/path/to/folder/                 list a directory
    GET    /api/v1.0/dropbox/exec/rm/path/to/folder-or-file/         remove a file or directory
    GET    /api/v1.0/dropbox/exec/mkdir/path/to/folder/              create a directory
    GET    /api/v1.0/dropbox/exec/cp/path/to/src/:/path/to/dst/      copy a file or directory
    GET    /api/v1.0/dropbox/exec/mv/path/to/src/:/path/to/dst/      move (rename) a file or directory
    GET    /api/v1.0/dropbox/exec/get/path/to/file.txt               access a file
    GET    /api/v1.0/dropbox/exec/put/path/to/file.txt:{string}      write data to a file
    POST    /api/v1.0/dropbox/exec/put/path/to/file.txt              write data to a file

#Applications configuration

Some services need an application registered on the plateform (GitHub, Dropbox...) to authorize Unifile. To activate them, you have to provide a `client_id` and a `client_secret` in the config object you pass to Unifile middleware. It have to be under the key namig the service:
```
{
  github: {
    "client_secret": SECRET_STRING,
    "client_id": ID_STRING
  }
}
```

#License

license: MIT

#Developer guide

Here is how to contribute

##Add a service

The services in unifile are cloud storage services, e.g. Dropbox and google drive.

Each service is a Node.js class implementing a given set of functions, e.g. ls, rm, cp...

If you wish to add a service,

* add your .js file in lib/services/ (duplicate the lib/services/dropbox.js file in order to have all the required methods)
* edit core/router.js to make your service reachable
* if you use an external node.js library, add the dependency in package.json

Here is a list of services which could be useful

* owncloud, cozy cloud, BTSync
* Box, SkyDrive, RapidShare, CloudMine, FilesAnywhere
* Amazon S3 and WebDav
* SugarSync
* Google drive if not too slow
* Facebook if possibe?
* a random list of other cloud storage services: Amazon Cloud Drive, Amazon S3, Bitcasa, Box, DollyDrive, Dropbox, Google Drive, iCloud Drive, Microsoft OneDrive, SpiderOak, SugarSync, Wuala

## Roadmap

**Let's discuss [this list of issues which set the future of unifile](https://github.com/silexlabs/unifile/labels/enhancement)**

unifile archi, tests and readme

## Notes

* doc: https://www.dreamfactory.com/developers/live_API
* mock, doc et tests: http://apiblueprint.org/
* https://npmjs.org/package/social-cms-backend
* tests http://stackoverflow.com/questions/11520170/unit-testing-oauth-js-with-mocha

to do

* app keys and sensitive info in env vars
* unit tests for get/put/cat
* pagination for ls commands?
* security: make the "allowCrossDomain" function look for the api key and det if the domain is allowed
* best practices for the api
  http://www.startupcto.com/backend-tech/building-an-api-best-practices
* mimic unix commands : /v1.0/gdrive/exec/?cmd="cd /example1/test/ ; cp img1.jpg img2.jpg ; ls"
* add a new service
