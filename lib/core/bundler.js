
'use strict';

/**
 * Bundles configuration inference from files distribution
 */

const util = require('util');
const path = require('path');
const stream = require('stream');
const constants = require('./constants');
const File = require('./file');

function Bundler(type, configuration) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.type = type || null;
	this.configuration = configuration || null;
	this.library = null;
}
util.inherits(Bundler, stream.Transform);

Bundler.create = function create(type, configuration) {
	const instance = new Bundler(type, configuration);
	instance.on('pipe', (src) => {
		instance.src = src;
	});
	return instance;
};

Bundler.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	if (!(file instanceof File) || file.type !== File.types.JAVASCRIPT) {
		this.emit('warn', file);
		done();
	} else {
		if (!this.type && this.src) this.type = this.src.type;
		if (!this.configuration && this.src) this.configuration = this.src.configuration;
		if (!this.library && this.src) this.library = this.src.library;
		this.registry.push(file);
		done();
	}
	return true;
};

function unique(value, index, arr) {
	return arr.indexOf(value) === index;
}

function getAlias(module, aliases) {
	let result = module;
	Object.keys(aliases).forEach((key) => {
		if (module === aliases[key]) result = key;
	});
	return result;
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
		this.registry.filter((value) =>
			value.parents && value.parents.length === 1 && value.parents[0].type === File.types.HTML &&
				!(this.type === constants.types.REQUIREJS && this.library && value.fullPath === this.library.fullPath)
		).forEach((value) => {
			bundles.push({ name: value.name, include: flattenDependencies(value, false).filter((dep) => common && dep !== common.name && common.include.indexOf(dep) === -1) });
		});

		// TODO
		// create bundle per conditionnal loading plugin

		// Bundler specific options
		let result;
		if (this.type === constants.types.REQUIREJS) { // RequireJS specific
			result = Object.assign(Object.assign({}, this.configuration || {}), { modules: [] });
			bundles.forEach((value, index) => {
				let bundle = value;
				if (this.configuration.baseUrl !== undefined) Object.assign(bundle, { name: path.relative(this.configuration.baseUrl, bundle.name) });
				if (this.configuration.paths !== undefined) bundle.name = getAlias(bundle.name, this.configuration.paths);
				if (index !== 0 && common) bundle = Object.assign(bundle, { exclude: [common.name] });
				if (bundle.include.length === 0) delete bundle.include;
				result.modules.push(bundle);
			});
		} else {
			result = Object.assign({}, { bundles });
		}
		this.push(result);
	}
	done();
};

module.exports = Bundler;
