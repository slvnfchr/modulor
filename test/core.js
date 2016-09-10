
'use strict';

const expect = require('chai').expect;
const path = require('path');
const File = require('../lib/core/file');
const walker = require('../lib/core/walker');
const dom = require('../lib/core/dom');
// const javascript = require('../lib/core/javascript');

describe('Core modules', () => {

	describe('Tree traversal', () => {

		it('Get current file', (done) => {
			walker.create(__dirname, ['core.js']).on('data', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.name).to.equal('core.js');
				expect(file.fullPath).to.equal(path.resolve(__dirname, file.path));
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
			const analyzer = dom.create().on('data', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.parents.length).to.be.above(0);
				expect(file.parents[0]).to.be.instanceof(File);
				expect(file.parents[0].name).to.match(/.*\.htm(l)?$/);
			}).on('finish', () => {
				done();
			});
			walker.create(__dirname, ['*.html', '*.html']).pipe(analyzer);
		});

		it('Test local HTML index file with all scripts integration modes', (done) => {
			let num = 0;
			const analyzer = dom.create().on('data', (file) => {
				expect(file.parents.length).to.equal(1);
				expect(file.parents[0].name).to.equal('index.html');
				if (num === 0) { // local linked script
					expect(file.name).to.equal('2.js');
				} else if (num === 1) { // local linked script with defered loading
					expect(file.name).to.equal('3.js');
				} else if (num === 2) { // local linked script with async loading
					expect(file.name).to.equal('4.js');
				}
				num += 1;
			}).on('end', () => {
				expect(num).to.equal(3);
				done();
			});
			walker.create(path.resolve(__dirname, 'examples/local'), ['index.html']).pipe(analyzer);
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
