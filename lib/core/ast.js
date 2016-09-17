
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
const constants = require('./constants');
const File = require('./file');

function ASTAnalyzer(type) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.src = null;
	this.type = type || null;
	this.configuration = null;
}
util.inherits(ASTAnalyzer, stream.Transform);

ASTAnalyzer.create = function create(type) {
	const instance = new ASTAnalyzer(type);
	instance.on('pipe', (src) => {
		instance.src = src;
	});
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
			if (module.match(new RegExp(`^(${key}|${key}\/.+)$`, 'i'))) {
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
	return {
		file: (pos !== -1) ? this.registry[pos] : this.registry[this.registry.length - 1],
		found: (pos !== -1),
	};
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

function getComplete(promises, cb) {
	if (promises.length > 1) {
		Promise.all(promises).then((values) => {
			cb.call(null, values);
		});
	} else if (promises.length === 1) {
		promises[0].then((value) => {
			cb.call(null, [value]);
		});
	} else {
		cb.call();
	}
}

ASTAnalyzer.prototype.analyzeFile = function analyzeFile(file, encoding, done) {
	const module = this.addFile(file);
	if (!module.found) {
		fs.readFile(module.file.fullPath, { encoding }, (err, data) => {
			if (err) {
				done();
				return;
			}
			const ast = esprima.parse(data);
			// detect RequireJS library
			if (!this.library) {
				this.library = amd.isRequireOrAlmond(ast) ? module.file : null;
				if (this.library) this.type = constants.types.REQUIREJS;
			}
			if (this.type === constants.types.REQUIREJS) {
				// detect RequireJS configuration from parsed modules and apply it to subsequent parsing
				if (!this.configuration) this.configuration = amd.getConfiguration(ast);
				// detect plugin type
				if (module.file.isPlugin) {
					module.file.isLoaderPlugin = amd.isLoaderPlugin(ast);
				}
			}
			// analyze file
			const analyze = amd.analyze(ast);
			// add named modules to registry
			analyze.modules.forEach((name) => {
				this.addFile(Object.assign(file, { name }));
			});
			// detect nested dependencies to sequence module parsing
			let nested = amd.analyze(ast, true).dependencies.filter((item) => analyze.dependencies.indexOf(item) === -1);
			// analyse dependencies, direct ones then nested ones
			const plugins = [];
			const pluginsMatch = /([^!]+)!([^!]+)/i;
			const dependencies = analyze.dependencies.map((dependency, index) => {
				const plugin = dependency.match(pluginsMatch);
				if (plugin) plugins.push({ name: plugin[2], index });
				return this.getFile(module.file, plugin ? plugin[1] : dependency, { isPlugin: plugin }, encoding);
			});
			getComplete(dependencies, (files) => {
				nested = nested.map((dependency) => this.getFile(module.file, dependency, null, encoding));
				plugins.forEach((plugin) => {
					if (files && files[plugin.index].isLoaderPlugin) {
						nested.push(this.getFile(module.file, plugin.name, { parents: [files[plugin.index]] }, encoding));
					}
				});
				getComplete(nested, () => done(module.file));
			});
		});
	} else {
		done(module.file);
	}
};

ASTAnalyzer.prototype.getFile = function getFile(file, module, properties, encoding) {
	let moduleName = module;
	const filePath = this.getPath(file, moduleName);
	let fileFullPath;
	if (filePath.match(/^\/\/|http/i)) { // external url
		return new Promise((resolve) => resolve()); // skip file
	} else if (filePath.match(/^\//i)) { // absolute path
		fileFullPath = path.resolve(path.dirname(file.root), `.${filePath}.js`);
	} else if (moduleName.match(/^\.(\.)?\//i)) { // relative path
		if (!file.name.match(/\.js$/i)) moduleName = url.resolve(file.name, moduleName);
		fileFullPath = path.resolve(path.dirname(file.fullPath), `${filePath}.js`);
	} else { // named module
		const root = getEntry(file);
		if (root) fileFullPath = path.resolve(path.dirname(root.fullPath), `${filePath}.js`);
	}
	return new Promise((resolve) => {
		const submodule = new File({
			root: file.root,
			name: moduleName,
			fullPath: fileFullPath,
			parents: [file],
			type: File.types.JAVASCRIPT,
		});
		Object.assign(submodule, properties);
		this.analyzeFile(submodule, encoding, (value) => {
			resolve(value);
		});
	});
};

ASTAnalyzer.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	if (!(file instanceof File) || file.type !== File.types.JAVASCRIPT) {
		this.emit('warn', file);
		done();
	} else {
		if (!this.type && this.src) this.type = this.src.type;
		this.analyzeFile(file, encoding, () => done());
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
