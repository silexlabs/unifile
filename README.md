#Unifile, unified access to cloud storage services.

[![Build Status](https://travis-ci.org/silexlabs/unifile.png?branch=master)](https://travis-ci.org/silexlabs/unifile)

Nodejs library to access cloud storage services with a common API.

Currently supported services

* FTP
* Dropbox
* GitHub: use git as a cloud with repository and branches as folder


#Motivation

In 2013, team has developed the v2 of [Silex](http://www.silex.me/), free and open source website builder for designers. Since Silex is a web app, running in the browser, we faced a choice: either we make people download and install Silex, or we host it in the cloud. But Silex Labs non profit organization can not afford paying hosting for our users.

So we have decided that Silex would edit the user's files on the user's Dropbox. It is not acceptable for a free project to force people to store their data on a service such as Dropbox, so we decided to make it an option. We have added the ability for Silex to edit files on the server on which it is installed. And then other services came to our minds.

We hope that other communities will benefit this way to use their cloud services before they install the web app locally.


#Use

Requirements

* [nodejs](http://nodejs.org/) > 6.0.0

#Use in your nodejs project

##With express

Add unifile lib to your project

```
$ npm install unifile --save
```

Then write a small node.js server [like this one](./samples/simple-api-server.js). Or play with the sample:

```
$ cd samples
$ npm install
$ node simple-api-server.js
```

Then open `http://localhost:6805/` and play with your cloud storages.



#License

[license: MIT](./LICENSE)

#Developer guide

Here is how to contribute

**FIXME**

##Add a service

**FIXME**

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

