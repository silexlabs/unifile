(function (global) {
	var assert = require("assert");
	var configManager = require('../../../lib/core/config-manager');
	var path = require('path');
	var firstConfigFilePath = 'config-data.js';
	var otherConfigFilePath = 'config-link-not-exist.js';

	describe('ConfigManager', function(){
		describe('#getConfig()', function(){
			it('should return null when the value is not present', function(){
				assert.equal(null, configManager.getConfig('notExisting', firstConfigFilePath, __dirname));
			});
			it('should return the data when the value is present in 1 config file', function(){
				assert.equal('only1DataValue', configManager.getConfig('only1Data', firstConfigFilePath, __dirname));
			});
			it('should merge data when the value is present in 2 confgig files', function(){
				// string
				assert.equal('string data value 2', configManager.getConfig('stringData', firstConfigFilePath, __dirname));
				// number
				assert.equal(2, configManager.getConfig('intData', firstConfigFilePath, __dirname));
				// array
				assert.deepEqual(["arr val 1.1", "arr val 1.2", "arr val 1.3", "arr val 2.1", "arr val 2.2", "arr val 2.3"], configManager.getConfig('arrayData', firstConfigFilePath, __dirname));
				// object
				assert.deepEqual({
					"prop1": "obj val 1.1",
					"prop2": "obj val 2.2",
					"prop3": "obj val 2.3",
					"prop4": "obj val 2.4"
				}, configManager.getConfig('objectData', firstConfigFilePath, __dirname));
			});
			it('should ignore a config file when it does not exist, even if it is referenced in a config file', function(){
				assert.doesNotThrow(function(){
					assert.equal('only1DataValue', configManager.getConfig('only1Data', otherConfigFilePath, __dirname));
				});
			});
		});
	});
}(this));