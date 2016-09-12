
'use strict';

/**
 * Javascript files AST analyzer
 */

const util = require('util');
const stream = require('stream');
const fs = require('fs');
const url = require('url');
const path = require('path');
const amdetective = require('amdetective');
const File = require('./file');

function ASTAnalyzer(options) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.options = options;
}
util.inherits(ASTAnalyzer, stream.Transform);

ASTAnalyzer.create = function create(options) {
	const instance = new ASTAnalyzer(options);
	this.options = options;
	return instance;
};

ASTAnalyzer.prototype.getPath = function getPath(context, moduleID) {
	let module = moduleID;
	if (!this.options) return module;
	if (this.options.map) { // RequireJS map configuration
		Object.keys(this.options.map).forEach((key) => {
			if (context.name.match(new RegExp(key, 'i'))) {
				if (this.options.map[key][module] !== undefined) {
					module = this.options.map[key][module];
				}
			}
		});
	}
	if (this.options.paths) { // RequireJS path configuration
		Object.keys(this.options.paths).forEach((key) => {
			if (module.match(new RegExp(`^${key}.*`, 'i'))) module = module.replace(key, this.options.paths[module]);
		});
	}
	return module;
};

ASTAnalyzer.prototype.addFile = function addFile(file) {
	const pos = this.registry.findIndex((item) => item.name === file.name);
	if (pos !== -1) {
		this.registry[pos].parents = this.registry[pos].parents.concat(file.parents);
	} else {
		this.registry.push(file);
	}
	if (file.parents && file.parents.length === 1 && file.parents[0].dependencies.indexOf(file) === -1) file.parents[0].dependencies.push(file);
	return (pos !== -1);
};

function getFile(analyzer, module, encoding) {
	return new Promise((resolve) => {
		analyzer._transform(module, encoding, () => { // eslint-disable-line no-underscore-dangle
			resolve();
		});
	});
}

ASTAnalyzer.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	const already = this.addFile(file);
	if (!already) {
		fs.readFile(file.fullPath, { encoding }, (err, data) => {
			// TODO
			// detect RequireJS configuration from parsed modules and apply it to subsequent parsing
			// detect nested dependencies to sequence module parsing
			const deps = amdetective.find(data, { findNestedDependencies: true });
			const dependencies = deps.moduleDeps.filter((value) => ['require', 'module', 'exports'].indexOf(value) === -1);
			let filePath;
			let fileFullPath;
			let moduleName;
			let module;
			for (let i = 0, n = dependencies.length; i < n; i += 1) {
				moduleName = dependencies[i];
				if (moduleName.match(/([^!]+)!([^!]+)/i)) {
					const plugin = moduleName.match(/([^!]+)!([^!]+)/i);
					moduleName = plugin[1];
					// TODO
					// Detect conditionnal loading plugin (no write function) vs inliner plugins (write function)
					// Therefore manage weak and strong dependencies
				}
				filePath = this.getPath(file, moduleName);
				if (filePath.match(/^\//i)) { // absolute path
					fileFullPath = path.resolve(path.dirname(file.root), `.${filePath}.js`);
				} else {
					if (!file.name.match(/\.js$/) && moduleName.match(/^\.(\.)?\//i)) moduleName = url.resolve(file.name, moduleName);
					fileFullPath = path.resolve(path.dirname(file.fullPath), `${filePath}.js`);
				}
				module = new File({
					root: file.root,
					name: moduleName,
					fullPath: fileFullPath,
					parents: [file],
					type: File.types.JAVASCRIPT,
				});
				dependencies[i] = getFile(this, module, encoding);
			}
			if (dependencies.length > 1) {
				Promise.all(dependencies).then(() => {
					done();
				});
			} else if (dependencies.length === 1) {
				dependencies[0].then(done);
			} else {
				done();
			}
		});
	} else {
		done();
	}
	return true;
};

ASTAnalyzer.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	for (let i = 0, n = this.registry.length; i < n; i += 1) {
		this.push(this.registry[i]);
	}
	done();
};

module.exports = ASTAnalyzer;
