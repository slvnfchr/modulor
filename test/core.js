
'use strict';

const expect = require('chai').expect;
const path = require('path');
const walker = require('../lib/core/walker');
const dom = require('../lib/core/dom');
// const javascript = require('../lib/core/javascript');

describe('Core modules', () => {

	describe('Tree traversal', () => {

		it('Get current file', (done) => {
			walker.create(__dirname, ['core.js']).on('data', (file) => {
				expect(file).to.have.include.keys(
					'name', 'root', 'path', 'parentDir', 'fullParentDir', 'fullPath'
				);
				expect(file.name).to.equal('core.js');
				expect(file.root).to.equal(__dirname);
				expect(file.fullParentDir).to.equal(path.resolve(file.root, file.parentDir));
				expect(file.fullPath.replace(file.root + path.sep, '')).to.equal(file.path);
				expect(file.fullPath).to.equal(path.resolve(file.root, file.path));
			}).on('end', () => {
				done();
			});
		});

		it('Get current directory javascript files', (done) => {
			walker.create(__dirname, ['*.js']).on('data', (file) => {
				expect(file.name).to.match(/.*\.js$/);
			}).on('end', () => {
				done();
			});
		});

		it('Get current directory HTML files', (done) => {
			walker.create(__dirname, ['*.html', '*.htm']).on('data', (file) => {
				expect(file.name).to.match(/.*\.htm(l)?$/);
			}).on('end', () => {
				done();
			});
		});

	});

	describe('HTML DOM analyzer', () => {

		it('Get scripts from HTML files', (done) => {
			const analyser = dom.create().on('data', (file) => {
				expect(file).to.have.all.keys('src', 'path', 'text', 'async', 'defer', 'documents');
				expect(file.documents).to.be.instanceof(Array);
			}).on('finish', () => {
				done();
			});
			walker.create(__dirname, ['*.html']).pipe(analyser);
		});

		it('Test local HTML index file with all scripts integration modes', (done) => {
			let num = 0;
			const analyser = dom.create().on('data', (file) => {
				expect(file.documents.length).to.equal(1);
				expect(file.documents[0].name).to.equal('index.html');
				expect(file.documents[0].root).to.equal(path.resolve(__dirname, 'examples/local'));
				if (num === 0) { // external linked script
					expect(file.src).to.equal('//domain.tld/1.js');
					expect(file.path).to.be.null;
					expect(file.defer).to.be.false;
					expect(file.async).to.be.false;
					expect(file.text).to.be.null;
				} else if (num === 1) { // local linked script
					expect(file.src).to.equal('2.js');
					expect(file.defer).to.be.false;
					expect(file.async).to.be.false;
					expect(file.text).to.be.null;
				} else if (num === 2) { // local linked script with defered loading
					expect(file.src).to.equal('3.js');
					expect(file.defer).to.be.true;
					expect(file.async).to.be.false;
					expect(file.text).to.be.null;
				} else if (num === 3) { // local linked script with async loading
					expect(file.src).to.equal('4.js');
					expect(file.defer).to.be.false;
					expect(file.async).to.be.true;
					expect(file.text).to.be.null;
				} else if (num === 4) { // inline
					expect(file.src).to.be.null;
					expect(file.defer).to.be.false;
					expect(file.async).to.be.false;
					expect(file.text.trim()).to.equal("var foo = 'bar';");
				}
				num += 1;
			}).on('end', () => {
				expect(num).to.equal(5);
				done();
			});
			walker.create(path.resolve(__dirname, 'examples/local'), ['index.html']).pipe(analyser);
		});

	});
/*
	describe('Javascript analyser', () => {

		it('Get scripts for each HTML file', (done) => {
			var javascript = javascript.create().on('data', (file) => {
				expect(file).to.have.include.keys(
					'name', 'root', 'path', 'parentDir', 'fullParentDir', 'fullPath', 'scripts'
				);
				expect(file.scripts).to.be.instanceof(Array);
				expect(file.scripts[0]).to.have.all.keys('src', 'source', 'async', 'defer', 'dependencies');
			}).on('end', () => {
				done();
			});
			walker.create(__dirname, ['local/*.html']).pipe(dom.create()).pipe(javascript);
		});

	});
*/
});
