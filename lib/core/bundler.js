
'use strict';

/**
 * Bundles configuration inference from files distribution
 */

const util = require('util');
const stream = require('stream');
const File = require('./file');

function Bundler(configuration) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.configuration = configuration;
}
util.inherits(Bundler, stream.Transform);

Bundler.create = function create(configuration) {
	const instance = new Bundler(configuration);
	this.configuration = configuration || {};
	return instance;
};

Bundler.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	if (!(file instanceof File) || file.type !== File.types.JAVASCRIPT) {
		this.emit('warn', file);
		done();
	} else {
		this.registry.push(file);
		done();
	}
	return true;
};

function unique(value, index, arr) {
	return arr.indexOf(value) === index;
}

function flattenDependencies(module) {
	let dependencies = [];
	module.dependencies.forEach((dependency) => {
		dependencies = dependencies.concat([dependency.name]);
		dependencies = dependencies.concat(flattenDependencies(dependency)).filter(unique);
	});
	return dependencies;
}

Bundler.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	if (this.registry.length > 0) {
		const configuration = Object.assign({ paths: {}, bundles: [] }, this.registry[0].configuration);
		// Merge redundant dependencies into a common bundle
		let common;
		this.registry.filter(
			(value) => value.parents && value.parents.length > 1 && value.parents[0].type === File.types.JAVASCRIPT
		).forEach((value) => {
			common = common || { name: value.name, include: [] };
			if (value.name !== common.name) common.include = common.include.concat([value.name]).filter(unique);
		});
		if (common) configuration.bundles.push(common);
		// Create bundle for each entry script
		this.registry.filter((value) =>
			value.parents && value.parents.length === 1 && value.parents[0].type === File.types.HTML
		).forEach((value) => {
			configuration.bundles.push({ name: value.name, include: flattenDependencies(value).filter((dep) => dep !== common.name && common.include.indexOf(dep) === -1) });
		});

		// TODO
		// create bundle per conditionnal loading plugin

		// Map new paths of modules
		configuration.bundles.forEach((value) => {
			value.include.forEach((include) => {
				configuration.paths[include] = value.name;
			});
		});
		this.push(configuration);
	}
	done();
};

module.exports = Bundler;
