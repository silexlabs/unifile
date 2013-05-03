
// check https://developers.google.com/drive/quickstart-js

/**
 * Service connector for the google drive api
 * 
 * Uses:
 * https://github.com/google/google-api-nodejs-client
 * 
 */

// config

var config ={};
config.gdrive = 
{
	client_secret_json : {"auth_uri":"https://accounts.google.com/o/oauth2/auth","client_secret":"8H5OatS9dhhnKlDL5pnVZ0Kr","token_uri":"https://accounts.google.com/o/oauth2/token","client_email":"1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3@developer.gserviceaccount.com","redirect_uris":["https://projects.silexlabs.org/silex/oauth2callback.php"],"client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3@developer.gserviceaccount.com","client_id":"1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3.apps.googleusercontent.com","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","javascript_origins":["https://projects.silexlabs.org/"]},
	client_id : "1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3.apps.googleusercontent.com",
};

var googleapis = require('googleapis');
var OAuth= require('oauth').OAuth;
var googleapis = require('googleapis'),
    OAuth2Client = googleapis.OAuth2Client;

var oauth2Client =
    new OAuth2Client(config.gdrive.client_id, config.gdrive.client_secret_json.client_secret, config.gdrive.client_secret_json.redirect_uris[0]);

var express = require("express");
var app = express();


app.get('/1/', function(req, res){
	// generates a url allows offline access and asks permissions
	// for Google+ scope.
	var url = oauth2Client.generateAuthUrl({
	  access_type: 'offline',
	  scope: 'https://www.googleapis.com/auth/plus.me'
	});
	res.send(url);
});

app.get('/2/', function(req, res){
	oauth2Client.getToken(req.params.code, function(err, tokens) {
	  // contains an access_token and optionally a refresh_token.
	  // save them permanently.
	  console.log("---");
	  console.log("getToken : ");
	  console.dir(err);
	  console.dir(tokens);
	  console.log("---");
		res.send(tokens);
	});
});



// ******* Server "loop"

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

