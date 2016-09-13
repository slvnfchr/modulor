
'use strict';

/**
 * File class
 */

const path = require('path');
const mime = require('mime-types');

function File(properties) {
	if (properties === undefined || !properties.fullPath) throw new Error('A fullPath property should be specified to instantiate a File object');
	this.root = properties.root || null;
	this.path = properties.path || null;
	this.fullPath = properties.fullPath || null;
	this.type = properties.type || (properties.fullPath ? mime.lookup(properties.fullPath) : null);
	this.name = properties.name || (this.fullPath ? path.basename(this.fullPath) : null);
	this.parents = properties.parents || [];
	this.dependencies = properties.dependencies || [];
}

File.create = function create(properties) {
	const instance = new File(properties);
	return instance;
};

File.types = {
	HTML: mime.types.html,
	JAVASCRIPT: mime.types.js,
};

module.exports = File;
