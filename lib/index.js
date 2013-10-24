/*
 * Unifile, unified access to cloud storage services.
 * https://github.com/silexlabs/unifile/
 *
 * Copyright (c) Silex Labs
 * Unifile is available under the GPL license
 * http://www.silexlabs.org/silex/silex-licensing/
 */
/*
 * About this file
 * This is the file which is included when the main script calls require('unifile')
 */
exports.middleware = require('./core/middleware.js').middleware;
exports.defaultConfig = require('./default-config.js');