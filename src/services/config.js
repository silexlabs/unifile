

//exports.app_key = "svr5id53hug36a7";
//exports.app_secret = "mpbhr91louaqk6o";

// dropbox

exports.dropbox = 
{
	root : "dropbox",
	app_key : "rvz6kvs9394dx8a",
	app_secret : "b0stxoj0zsxy14m",
}

// gdrive
// the app must be decalred 
// and have a callback url set to [node server url]/gdrive/auth_callback/
exports.gdrive = 
{
	auth_uri : "https://accounts.google.com/o/oauth2/auth",
	client_secret : "8H5OatS9dhhnKlDL5pnVZ0Kr",
	token_uri : "https://accounts.google.com/o/oauth2/token",
	client_email : "1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3@developer.gserviceaccount.com","redirect_uris":["http://silex-v2.herokuapp.com/gdrive/auth_callback/"],
	client_x509_cert_url : "https://www.googleapis.com/robot/v1/metadata/x509/1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3@developer.gserviceaccount.com",
	client_id : "1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3.apps.googleusercontent.com",
	auth_provider_x509_cert_url : "https://www.googleapis.com/oauth2/v1/certs",
	javascript_origins : ["https://projects.silexlabs.org/"],
	client_id : "1092494939602-js3q389sjqn9hql42g1o9mktpb4fcan3.apps.googleusercontent.com",

	app_scope:"https://www.googleapis.com/auth/drive.install", // see https://developers.google.com/drive/scopes
	app_access_type:"online",
	auth_url_callback: "/gdrive/auth_callback/", // path which we expect when the user comes back to our app after authorizing on google server
};