
'use strict';

/**
 * Module main file
 */

const File = require('./core/file');
const Walker = require('./core/walker');
const DOMAnalyzer = require('./core/dom');
const ASTAnalyzer = require('./core/ast');
const Bundler = require('./core/bundler');
const constants = require('./core/constants');

module.exports = function modulor(path) {
	return Walker.create(path, ['*.html', '*.htm']).pipe(DOMAnalyzer.create()).pipe(ASTAnalyzer.create()).pipe(Bundler.create());
};
module.exports.File = File;
module.exports.Walker = Walker;
module.exports.DOMAnalyzer = DOMAnalyzer;
module.exports.ASTAnalyzer = ASTAnalyzer;
module.exports.Bundler = Bundler;
module.exports.types = constants.types;
