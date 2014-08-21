var fs = require('fs');
var jade = require('jade');

/**
 * display the login form with options
 */
exports.displayLoginForm = function(httpCode, response, templateFile, cssFile, options){
  // load jade template file
  fs.readFile(templateFile, 'utf8', function (err, templateData) {
    if (err){
      response.send(500, 'Could not open template file ' + templateFile);
    }
    else{
      // load css file
      fs.readFile(cssFile, 'utf8', function (err, cssData) {
        if (err){
          response.send(500, 'Could not open css file ' + cssFile);
        }
        else{
          // add css to the options
          options.css = cssData;
          // render the HTML and return it
          var fn = jade.compile(templateData);
          var html = fn(options);
          response.status(httpCode).send(html);
        }
      });
    }
  });
};


