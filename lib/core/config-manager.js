fs = require('fs');
pathModule = require('path');

/**
 * get config value
 * take several config files into account
 * @param 	propName 	name of the property to get
 * @return 	value of the property in the config files
 */
exports.getConfig = function(propName, opt_firstConfig, opt_rootFolder){
	// default value for root folder
	var rootFolder;
	if (opt_rootFolder){
		rootFolder = opt_rootFolder;
	}
	else{
		rootFolder = __dirname;
	}
	// default value for first config
	var firstConfig;
	if (opt_firstConfig){
		firstConfig = require(pathModule.resolve(rootFolder, opt_firstConfig));
	}
	else{
		firstConfig = require(pathModule.resolve(rootFolder, '../../unifile-config.js'));
	}
	// value of config in the first config file
	var propValue = firstConfig[propName];

	// recursive call to take other config files into account
	return exports.getConfigRecursive(firstConfig.otherConfFiles, propName, propValue, rootFolder);
}
/**
 * get config value in the other config files
 * marge the other data depending on the config var type
 * @private
 */
exports.getConfigRecursive = function(files, propName, propValue, rootFolder){
	var propValue;
	for(var fileNameIdx in files){
		var fileName = pathModule.resolve(rootFolder, files[fileNameIdx]);
		var exists = fs.existsSync(fileName);
		if (exists){
			var otherConfig = require(fileName);
			var otherPropValue = otherConfig[propName];
			if (otherPropValue){
				if (typeof(otherPropValue) == 'object'){
					if (otherPropValue.push==undefined){
						// object
						if (!propValue) propValue = {};
						propValue = exports.mergeObjects(propValue, otherPropValue);
					}
					else{
						// array
						if (!propValue) propValue = [];
						propValue = exports.mergeArray(propValue, otherPropValue);
					}
				}
				else{
					// other
					propValue = otherPropValue;
				}
			}
			// also take into account the other conf files in the loaded conf
			if (otherConfig.otherConfFiles){
				propValue = exports.getConfigRecursive(otherConfig.otherConfFiles, propName, propValue, rootFolder);
			}
		}
		else{
			console.warn('Warning: the config file '+fileName+' is referenced in unifile config files (in "otherConfFiles" config variable) but could not be found. This config file will be ignored.');
		}
	}
	return propValue;
}
/**
 * merge two objects or arrays and return the mix of the two
 */
exports.mergeObjects = function(obj1, obj2){
	var res = {};
	for(var propName in obj1){
		res[propName] = obj1[propName]
	}
	for(var propName in obj2){
		res[propName] = obj2[propName]
	}
	return res;
}
/**
 * merge two objects or arrays and return the mix of the two
 */
exports.mergeArray = function(obj1, obj2){
	var res = [];
	for(var propName in obj1){
		res.push(obj1[propName]);
	}
	for(var propName in obj2){
		res.push(obj2[propName]);
	}
	return res;
}
