
'use strict';

/**
 * Bundles configuration inference from files distribution
 */

const util = require('util');
const path = require('path');
const stream = require('stream');
const constants = require('./constants');
const File = require('./file');

function Bundler() {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
}
util.inherits(Bundler, stream.Transform);

Bundler.create = function create() {
	const instance = new Bundler();
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

function flattenDependencies(module, deep) {
	let dependencies = [];
	module.dependencies.forEach((dependency) => {
		dependencies = dependencies.concat([dependency.name]);
		if (deep) dependencies = dependencies.concat(flattenDependencies(dependency, deep)).filter(unique);
	});
	return dependencies;
}

Bundler.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	if (this.registry.length > 0) {
		const bundles = [];
		// Merge redundant dependencies into a common bundle
		let common;
		this.registry.filter(
			(value) => value.parents && value.parents.length > 1 && value.parents[0].type === File.types.JAVASCRIPT
		).forEach((value) => {
			common = common || { name: value.name, include: [] };
			if (value.name !== common.name) common.include = common.include.concat([value.name]).filter(unique);
		});
		if (common) bundles.push(common);
		// Create bundle for each entry script
		let bundler;
		this.registry.filter((value) =>
			value.parents && value.parents.length === 1 && value.parents[0].type === File.types.HTML
		).forEach((value) => {
			bundler = value.bundler;
			bundles.push({ name: value.name, include: flattenDependencies(value, false).filter((dep) => dep !== common.name && common.include.indexOf(dep) === -1) });
		});

		// TODO
		// create bundle per conditionnal loading plugin

		// Bundler specific options
		let result;
		if (bundler === constants.bundlers.REQUIREJS) { // RequireJS specific
			const configuration = Object.assign({}, this.registry[0].configuration);
			result = Object.assign(Object.assign({}, configuration), { modules: [] });
			bundles.forEach((value, index) => {
				let bundle = value;
				if (configuration.baseUrl !== undefined) Object.assign(bundle, { name: path.relative(configuration.baseUrl, bundle.name) });
				if (index !== 0) bundle = Object.assign(bundle, { exclude: [bundles[0].name] });
				result.modules.push(bundle);
			});
		} else { // Webpack
			result = Object.assign({}, { bundles });
		}
		this.push(result);
	}
	done();
};

module.exports = Bundler;
