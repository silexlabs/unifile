#Unifile, unified access to cloud storage services.

[![Build Status](https://travis-ci.org/silexlabs/unifile.png?branch=master)](https://travis-ci.org/silexlabs/unifile)

Express middleware to provide web services for accessing cloud storage services with a common API.

Currently supported services

* FTP
* Dropbox
* local web server
* see instructions bellow to add a service

Example

    GET    /api/v1.0/dropbox/exec/ls/path/to/folder/                 list a directory of the loggedin user


#Motivation

In 2013, team has developed the v2 of [Silex](http://www.silex.me/), free and open source website builder for designers. Since Silex is a web app, running in the browser, we faced a choice: either we make people download and install Silex, or we host it in the cloud. But Silex Labs non profit organization can not afford paying hosting for our users.

So we have decided that Silex would edit the user's files on the user's Dropbox. It is not acceptable for a free project to force people to store their data on a service such as Dropbox, so we decided to make it an option. We have added the ability for Silex to edit files on the server on which it is installed. And then other services came to our minds.

We hope that other communities will benefit this way to use their cloud services before they install the web app locally.

#How to install

With node installed ([download](http://nodejs.org/download)), install unifile in your project (the ```-save``` option will add the latest version of unifile to your package.json file)

    $ npm install unifile -save

Then write a small node.js server like this and name it ```server.js```

    // node modules
    var unifile = require('unifile');
    var express = require('express');
    var app = express();

    // config
    var options = unifile.defaultConfig;

    // use unifile as a middleware
    app.use(unifile.middleware(express, app, options));

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

#REST APIs

Let's take the example of the Dropbox service

Connect to the service

Basic login and such

    GET    /api/v1.0/dropbox/connect/       returns an URL, which you will open and authorize unifile to access the service (this is an oauth2 authorization mechanism)
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

#License

license: GPL v2

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

* Box, SkyDrive, RapidShare, CloudMine, FilesAnywhere
* Amazon S3 and WebDav
* SugarSync
* Google drive if not too slow
* Facebook if possibe?

##Notes / roadmap

* http://localhost:6805/api/v1.0/www/connect/ bug
* doc: list of supported services (also in CE)
* service www: use jade templates

unifile archi, tests and readme

* doc: https://www.dreamfactory.com/developers/live_API
* https://npmjs.org/package/social-cms-backend
* tests http://stackoverflow.com/questions/11520170/unit-testing-oauth-js-with-mocha

to do

* unit tests for get/put/cat
* pagination for ls commands?
* security: make the "allowCrossDomain" function look for the api key and det if the domain is allowed
* best practices for the api
  http://www.startupcto.com/backend-tech/building-an-api-best-practices
* mimic unix commands : /v1.0/gdrive/exec/?cmd="cd /example1/test/ ; cp img1.jpg img2.jpg ; ls"
* add a new service


