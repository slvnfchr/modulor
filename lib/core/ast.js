
'use strict';

/**
 * Javascript files AST analyzer
 */

const util = require('util');
const stream = require('stream');
const fs = require('fs');
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
	return instance;
};

ASTAnalyzer.prototype.inject = function inject(file, module) {
	const pos = this.registry.findIndex((item) => item.fullPath === module.fullPath);
	if (pos !== -1) {
		this.registry[pos].parents.push(file);
	} else {
		this.registry.push(Object.assign(module, { parents: [file] }));
	}
	file.dependencies.push(module);
	return true;
};

ASTAnalyzer.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	const code = fs.readFileSync(file.fullPath).toString();
	const deps = amdetective.find(code, { findNestedDependencies: true });
	const dependencies = deps.moduleDeps;
	for (let i = 0, n = dependencies.length; i < n; i += 1) {
		if (dependencies[i].match(/^\.(\.)?\//i)) {
			this.inject(file, new File({ fullPath: path.resolve(path.dirname(file.fullPath), `${dependencies[i]}.js`) }));
		}
	}
	done();
	return true;
};

ASTAnalyzer.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	for (let i = 0, n = this.registry.length; i < n; i += 1) {
		this.push(this.registry[i]);
	}
	done();
};

module.exports = ASTAnalyzer;
