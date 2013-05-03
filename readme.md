#Use


##Auth

Install and run the node.js server or test online on http://silex-v2.herokuapp.com/

Open the root URL in a browser, e.g. http://silex-v2.herokuapp.com/
Follow the links, and find a SaaS cloud storage service, then go to its "connect" method, e.g.
* http://silex-v2.herokuapp.com/v1.0/dropbox/connect/

It will return a "authorize_url", which you will open in a new browser window. Then back to the previous window, open the "login" method, e.g.
* http://silex-v2.herokuapp.com/v1.0/dropbox/login/

##Services

After authenticating to a cloud storage service, you can call these methods

* logout/
* account/

##Commands

After authenticating to a cloud storage service, you can use these commands

* ls
  list directory contents
  params: the path of the directory
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/ls/
  /v1.0/dropbox/ls/path/to/folder/
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/ls/path/to/folder/
* rm
  remove files or directories
  params: the path of the directory
  /v1.0/dropbox/rm/path/to/folder-or-file/
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/rm/path/to/folder-or-file/
* mkdir
  create a directory
  params: the path of the directory
  /v1.0/dropbox/mkdir/path/to/folder/
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/mkdir/path/to/folder/
* cp
  copy files and directories
  params: path of the source file/folder and of the destination file/folder
  /v1.0/dropbox/cp/path/to/src/:/path/to/dst/
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/cp/path/to/src/:/path/to/dst/
* mv
  move (rename) files and directories
  params: path of the source file/folder and of the destination file/folder
  /v1.0/dropbox/mv/path/to/src/:/path/to/dst/
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/mv/path/to/src/:/path/to/dst/
* get
  print the content of a file
  params: the path of the file
  /v1.0/dropbox/get/path/to/file.txt
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/get/path/to/file.txt
* put
  write data to a file
  params: the path of the file, and the data as POST data or in GET after ":"
  /v1.0/dropbox/get/path/to/file.txt:hello world!
  example: http://silex-v2.herokuapp.com/v1.0/dropbox/get/path/to/file.txt:hello world!


to do
- finish gdocs commands
- pagination for ls commands
- appliquer les best practices 
  http://www.startupcto.com/backend-tech/building-an-api-best-practices
- route info in the results, ou plutot test dans le chemin => navigation comme dans des dossiers d'un serveur web
  http://adamwhitcroft.com/apaxy/
  http://www.linickx.com/files/
  http://antisleep.com/indices/
  http://www.webmasterworld.com/apache/3589651.htm
- facebook and twitter 