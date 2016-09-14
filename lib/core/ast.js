
'use strict';

/**
 * Javascript files AST analyzer
 */

const util = require('util');
const stream = require('stream');
const fs = require('fs');
const url = require('url');
const path = require('path');
const esprima = require('esprima');
const amd = require('./ast/amd');
const File = require('./file');

function ASTAnalyzer(configuration) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.configuration = configuration || {};
}
util.inherits(ASTAnalyzer, stream.Transform);

ASTAnalyzer.create = function create(configuration) {
	const instance = new ASTAnalyzer(configuration);
	this.configuration = configuration;
	return instance;
};

ASTAnalyzer.prototype.getPath = function getPath(context, moduleID) {
	let module = moduleID;
	if (!this.configuration) return module;
	if (this.configuration.map) { // RequireJS map configuration
		Object.keys(this.configuration.map).forEach((key) => {
			if (context.name.match(new RegExp(key, 'i'))) {
				if (this.configuration.map[key][module] !== undefined) {
					module = this.configuration.map[key][module];
				}
			}
		});
	}
	if (this.configuration.paths) { // RequireJS path configuration
		Object.keys(this.configuration.paths).forEach((key) => {
			if (module.match(new RegExp(`^${key}.*`, 'i'))) {
				module = module.replace(key, this.configuration.paths[key]);
			}
		});
	}
	if (this.configuration.baseUrl && moduleID.match(/^[^\/\.]/i)) {
		module = url.resolve(`${this.configuration.baseUrl}/`, module);
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

function getEntry(file) {
	if (file.parents.length === 0) return false;
	let entry;
	if (file.parents[0].type === File.types.HTML) {
		entry = file.parents[0];
	} else {
		entry = getEntry(file.parents[0]);
	}
	return entry;
}

function getFile(analyzer, file, module, encoding) {
	let moduleName = module;
	if (moduleName.match(/([^!]+)!([^!]+)/i)) {
		const plugin = moduleName.match(/([^!]+)!([^!]+)/i);
		moduleName = plugin[1];
		// TODO
		// Detect conditionnal loading plugin (no write function) vs inliner plugins (write function)
		// Therefore manage weak and strong dependencies
	}
	const filePath = analyzer.getPath(file, moduleName);
	let fileFullPath;
	if (filePath.match(/^\//i)) { // absolute path
		fileFullPath = path.resolve(path.dirname(file.root), `.${filePath}.js`);
	} else if (moduleName.match(/^\.(\.)?\//i)) { // relative path
		if (!file.name.match(/\.js$/i)) moduleName = url.resolve(file.name, moduleName);
		fileFullPath = path.resolve(path.dirname(file.fullPath), `${filePath}.js`);
	} else { // named module
		const root = getEntry(file);
		if (root) fileFullPath = path.resolve(path.dirname(root.fullPath), `${filePath}.js`);
	}
	return new Promise((resolve) => {
		analyzer._transform(new File({ // eslint-disable-line no-underscore-dangle
			root: file.root,
			name: moduleName,
			fullPath: fileFullPath,
			parents: [file],
			type: File.types.JAVASCRIPT,
		}), encoding, () => {
			resolve();
		});
	});
}

function getComplete(promises, cb) {
	if (promises.length > 1) {
		Promise.all(promises).then(() => {
			cb.call();
		});
	} else if (promises.length === 1) {
		promises[0].then(cb);
	} else {
		cb.call();
	}
}

ASTAnalyzer.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	if (!(file instanceof File) || file.type !== File.types.JAVASCRIPT) {
		this.emit('warn', file);
		done();
	} else {
		const already = this.addFile(file);
		if (!already) {
			fs.readFile(file.fullPath, { encoding }, (err, data) => {
				if (err) {
					done();
					return;
				}
				const ast = esprima.parse(data);
				// detect RequireJS configuration from parsed modules and apply it to subsequent parsing
				Object.assign(this.configuration, amd.getConfiguration(ast));
				// analyze file
				const analyze = amd.analyze(ast);
				// add named modules to registry
				analyze.modules.forEach((module) => {
					this.addFile(Object.assign(file, { name: module }));
				});
				// detect nested dependencies to sequence module parsing
				let nested = amd.analyze(ast, true).dependencies.filter((item) => analyze.dependencies.indexOf(item) === -1);
				// analyse dependencies, direct ones then nested ones
				const dependencies = analyze.dependencies.map((dependency) => getFile(this, file, dependency, encoding));
				getComplete(dependencies, () => {
					nested = nested.map((dependency) => getFile(this, file, dependency, encoding));
					getComplete(nested, done);
				});
			});
		} else {
			done();
		}
	}
	return true;
};

ASTAnalyzer.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	for (let i = 0, n = this.registry.length; i < n; i += 1) {
		this.push(Object.assign(this.registry[i], { configuration: this.configuration }));
	}
	done();
};

module.exports = ASTAnalyzer;
