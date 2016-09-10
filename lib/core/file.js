
'use strict';

/**
 * File class
 */

const path = require('path');

function File(options) {
	this.path = options.path || null;
	this.fullPath = options.fullPath || null;
	this.name = options.name || path.basename(this.fullPath);
	this.parents = options.parents || [];
	this.dependencies = options.dependencies || [];
}

module.exports = File;
