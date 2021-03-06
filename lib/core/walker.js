
'use strict';

/**
 * File tree traversal stream module
 */

const util = require('util');
const stream = require('stream');
const readdirp = require('readdirp');
const File = require('./file');

function Walker(root, filter) {
	stream.Readable.call(this, { objectMode: true });
	this.root = root;
	this.filter = filter;
}
util.inherits(Walker, stream.Readable);

Walker.create = function create(source, filter) {
	const instance = new Walker(source, filter);
	return instance;
};

Walker.prototype.setup = function setup() {
	this.readdirp = readdirp({ root: this.root, fileFilter: this.filter });
	this.readdirp.on('data', (file) => {
		this.push(new File(Object.assign({ root: this.root }, file)));
	}).on('end', () => {
		this.push(null);
	});
};

Walker.prototype._read = function _read() { // eslint-disable-line no-underscore-dangle
	if (!this.readdirp) this.setup();
};

module.exports = Walker;
