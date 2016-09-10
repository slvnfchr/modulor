
'use strict';

/**
 * HTML registry analyzer
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const stream = require('stream');
const jsdom = require('jsdom').jsdom;
const File = require('./file');

function DOMAnalyzer(options) {
	stream.Transform.call(this, { objectMode: true });
	this.registry = [];
	this.options = options;
}
util.inherits(DOMAnalyzer, stream.Transform);

DOMAnalyzer.create = function create(options) {
	const instance = new DOMAnalyzer(options);
	return instance;
};

DOMAnalyzer.prototype.inject = function inject(file, script) {
	const pos = this.registry.findIndex((item) => item.fullPath === script.fullPath);
	if (pos !== -1) {
		this.registry[pos].parents.push(file);
	} else {
		this.registry.push(Object.assign(script, { parents: [file] }));
	}
	file.dependencies.push(script);
	return true;
};

DOMAnalyzer.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
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
		let filePath;
		for (let i = 0, n = elements.length; i < n; i += 1) {
			filePath = !elements[i].src.match(/^(http(s)?|\/\/)/) ?
				path.resolve(path.dirname(file.fullPath), elements[i].src) : null;
			if (filePath) this.inject(file, new File({ fullPath: filePath }));
			if (elements[i].hasAttribute('data-main')) { // requireJS style
				this.inject(file, new File({ fullPath: path.resolve(path.dirname(file.fullPath), `${elements[i].getAttribute('data-main')}.js`) }));
			}
		}
		done();
		return true;
	});
	return false;
};

DOMAnalyzer.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	for (let i = 0, n = this.registry.length; i < n; i += 1) {
		this.push(this.registry[i]);
	}
	done();
};

module.exports = DOMAnalyzer;
