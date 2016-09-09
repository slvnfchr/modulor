
'use strict';

/**
 * File tree traversal stream module
 */

const util = require('util');
const stream = require('stream');
const readdirp = require('readdirp');

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
		this.push(Object.assign({}, file, { root: this.root }));
	}).on('end', () => {
		this.push(null);
	});
};

Walker.prototype._read = function _read() { // eslint-disable-line no-underscore-dangle
	if (!this.readdirp) this.setup();
};

module.exports = Walker;
