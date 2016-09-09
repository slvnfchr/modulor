
'use strict';

/**
 * HTML files analyzer
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const stream = require('stream');
const jsdom = require('jsdom').jsdom;

function DOMAnalyser(options) {
	stream.Transform.call(this, { objectMode: true });
	this.scripts = [];
	this.options = options;
}
util.inherits(DOMAnalyser, stream.Transform);

DOMAnalyser.create = function create(options) {
	const instance = new DOMAnalyser(options);
	return instance;
};

DOMAnalyser.prototype.inject = function inject(file, script) {
	let pos = -1;
	if (script.src) pos = this.scripts.findIndex((item) => item.src === script.src);
	if (pos !== -1) {
		this.scripts[pos].documents.push(file);
	} else {
		this.scripts.push(Object.assign(script, { documents: [file] }));
	}
	return true;
};

DOMAnalyser.prototype._transform = function transform(file, encoding, done) { // eslint-disable-line no-underscore-dangle, max-len
	fs.readFile(file.fullPath, { encoding: 'utf-8' }, (err, data) => {
		if (err) return false;
		const script = { src: null, path: null, text: null, async: false, defer: false };
		const doc = jsdom(data, {
			features: {
				FetchExternalResources: false,
				ProcessExternalResources: false,
				SkipExternalResources: false,
			},
		});
		let elements = doc.querySelectorAll('script[src]');
		let filePath;
		for (let i = 0, n = elements.length; i < n; i += 1) {
			filePath = !elements[i].src.match(/^(http(s)?|\/\/)/) ?
				path.resolve(file.path, elements[i].src) : null;
			this.inject(file, Object.assign({}, script, {
				src: elements[i].src,
				path: filePath,
				async: elements[i].hasAttribute('async'),
				defer: elements[i].hasAttribute('defer'),
			}));
			if (elements[i].hasAttribute('data-main')) { // requireJS style
				this.inject(file, Object.assign({}, script, {
					src: elements[i].getAttribute('data-main'),
					path: path.resolve(filePath, elements[i].src),
				}));
			}
		}
		elements = doc.querySelectorAll('script:not([src])');
		for (let i = 0, n = elements.length; i < n; i += 1) {
			this.inject(file, Object.assign({}, script, { text: elements[i].textContent }));
		}
		done();
		return true;
	});
	return false;
};

DOMAnalyser.prototype._flush = function flush(done) { // eslint-disable-line no-underscore-dangle
	for (let i = 0, n = this.scripts.length; i < n; i += 1) {
		this.push(this.scripts[i]);
	}
	done();
};

module.exports = DOMAnalyser;
