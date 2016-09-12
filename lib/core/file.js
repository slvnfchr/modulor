
'use strict';

/**
 * File class
 */

const path = require('path');

function File(options) {
	this.root = options.root || null;
	this.path = options.path || null;
	this.fullPath = options.fullPath || null;
	this.type = options.type || File.types.HTML;
	this.name = options.name || (this.fullPath ? path.basename(this.fullPath) : null);
	this.parents = options.parents || [];
	this.dependencies = options.dependencies || [];
}

File.types = {
	HTML: 'text/html',
	JAVASCRIPT: 'text/javascript',
};

module.exports = File;
