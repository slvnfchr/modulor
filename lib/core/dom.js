
'use strict';

/**
 * HTML registry analyzer
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const stream = require('stream');
const jsdom = require('jsdom').jsdom;
const constants = require('./constants');
const File = require('./file');

function DOMAnalyzer(options) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.type = null;
	this.options = options;
}
util.inherits(DOMAnalyzer, stream.Transform);

DOMAnalyzer.create = function create(options) {
	const instance = new DOMAnalyzer(options);
	return instance;
};

DOMAnalyzer.prototype.addFile = function addFile(file, filePath, fileName) {
	const fileFullPath = filePath.match(/^(\.(\.)?\/|[^\.\/])/i) ? path.resolve(path.dirname(file.fullPath), filePath) : path.resolve(file.root, `.${filePath}`);
	const script = new File({ root: file.root, name: fileName, fullPath: fileFullPath, parents: [file], type: File.types.JAVASCRIPT });
	let pos = this.registry.findIndex((item) => item.fullPath === script.fullPath);
	if (pos !== -1) {
		this.registry[pos].parents = this.registry[pos].parents.concat([file]);
	} else {
		this.registry.push(script);
		pos = this.registry.length - 1;
	}
	file.dependencies.push(this.registry[pos]);
	return this.registry[pos];
};

DOMAnalyzer.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	if (!(file instanceof File) || file.type !== File.types.HTML) {
		this.emit('warn', file);
		done();
	} else {
		fs.readFile(file.fullPath, { encoding: 'utf-8' }, (err, data) => {
			if (err) return false;
			const doc = jsdom(data, {
				features: {
					FetchExternalResources: false,
					ProcessExternalResources: false,
					SkipExternalResources: false,
				},
			});
			const elements = doc.querySelectorAll('script[src]');
			for (let i = 0, n = elements.length; i < n; i += 1) {
				if (!elements[i].src.match(/^(http(s)?|\/\/)/)) {
					this.addFile(file, elements[i].src);
					if (elements[i].hasAttribute('data-main')) { // requireJS style
						this.addFile(file, `${elements[i].getAttribute('data-main')}.js`, elements[i].getAttribute('data-main'));
						this.type = constants.types.REQUIREJS;
					}
				}
			}
			done();
			return true;
		});
	}
	return true;
};

DOMAnalyzer.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	for (let i = 0, n = this.registry.length; i < n; i += 1) {
		this.push(this.registry[i]);
	}
	done();
};

module.exports = DOMAnalyzer;
