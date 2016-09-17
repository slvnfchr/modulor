
'use strict';

const expect = require('chai').expect;
const assert = require('chai').assert;
const path = require('path');
const File = require('../lib/core/file');
const Walker = require('../lib/core/walker');
const DOMAnalyzer = require('../lib/core/dom');
const ASTAnalyzer = require('../lib/core/ast');
const Bundler = require('../lib/core/bundler');
const constants = require('../lib/core/constants');

describe('Core modules', () => {

	describe('File class', () => {

		it('fullPath property is required and should be not null or empty for any File instantiation', (done) => {
			expect(File.create).to.throw(Error);
			expect(File.create.bind(File, { fullPath: null })).to.throw(Error);
			expect(File.create.bind(File, { fullPath: '' })).to.throw(Error);
			expect(File.create.bind(File, { fullPath: '/path/to/file' })).not.to.throw(Error);
			done();
		});

		it('Minimal File instantiation', (done) => {
			const name = 'test.htm';
			const file = File.create({ fullPath: path.resolve(__dirname, name) });
			expect(file).to.have.all.keys('root', 'name', 'path', 'fullPath', 'type', 'parents', 'dependencies');
			expect(file.root).to.be.null;
			expect(file.name).to.equal(name);
			expect(file.path).to.be.null;
			expect(file.fullPath).to.equal(path.resolve(__dirname, name));
			expect(file.type).to.equal(File.types.HTML);
			expect(file.parents).to.be.instanceof(Array);
			expect(file.dependencies).to.be.instanceof(Array);
			done();
		});

		it('Full File instantiation', (done) => {
			const properties = {
				root: __dirname,
				name: 'test.js',
				path: 'test/test.js',
				fullPath: '/path/to/test.js',
				type: 'test',
				parents: [File.create({ fullPath: 'parent' })],
				dependencies: [File.create({ fullPath: 'dependency' })],
			};
			const file = File.create(properties);
			expect(file).to.deep.equal(properties);
			done();
		});

		it('File mimetype should be inferred from fullPath', (done) => {
			expect(File.create({ fullPath: 'test.htm' }).type).to.be.equal(File.types.HTML);
			expect(File.create({ fullPath: 'test.html' }).type).to.be.equal(File.types.HTML);
			expect(File.create({ fullPath: 'test.js' }).type).to.be.equal(File.types.JAVASCRIPT);
			done();
		});

	});

	describe('Tree traversal', () => {

		it('Get current file', (done) => {
			Walker.create(__dirname, ['core.js']).on('data', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.name).to.equal('core.js');
				expect(file.fullPath).to.equal(path.resolve(__dirname, file.path));
			}).on('end', () => {
				done();
			});
		});

		it('Get current directory javascript files', (done) => {
			Walker.create(__dirname, ['*.js']).on('data', (file) => {
				expect(file.name).to.match(/.*\.js$/);
			}).on('end', () => {
				done();
			});
		});

		it('Get current directory HTML files', (done) => {
			Walker.create(__dirname, ['*.html', '*.htm']).on('data', (file) => {
				expect(file.name).to.match(/.*\.htm(l)?$/);
			}).on('end', () => {
				done();
			});
		});

		it('Get current directory non HTML files', (done) => {
			Walker.create(__dirname, ['!*.html', '!*.htm']).on('data', (file) => {
				expect(file.name).not.to.match(/.*\.htm(l)?$/);
			}).on('end', () => {
				done();
			});
		});

	});

	describe('DOM analyzer', () => {

		it('Ignore non HTML files', (done) => {
			const analyzer = DOMAnalyzer.create().on('data', () => {
				assert(false, 'No data event should be emitted');
			}).on('warn', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.type).not.to.equal(File.types.HTML);
			}).on('end', () => {
				done();
			});
			Walker.create(__dirname, ['core.js']).pipe(analyzer);
		});

		it('Get entries scripts from HTML files', (done) => {
			const analyzer = DOMAnalyzer.create().on('data', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.type).to.equal(File.types.JAVASCRIPT);
				expect(file.parents.length).to.be.above(0);
				expect(file.parents[0]).to.be.instanceof(File);
				expect(file.parents[0].type).to.equal(File.types.HTML);
			}).on('end', () => {
				done();
			});
			Walker.create(__dirname, ['*.html', '*.html']).pipe(analyzer);
		});

		it('Test local HTML index file with all scripts integration modes', (done) => {
			let num = 0;
			const analyzer = DOMAnalyzer.create().on('data', (file) => {
				expect(file.parents.length).to.equal(1);
				expect(file.parents[0].name).to.equal('index.html');
				if (num === 0) { // local linked script
					expect(file.name).to.equal('require.js');
				} else if (num === 1) { // local linked script
					expect(file.name).to.equal('2.js');
				} else if (num === 2) { // local linked script with defered loading
					expect(file.name).to.equal('3.js');
				} else if (num === 3) { // local linked script with async loading
					expect(file.name).to.equal('4.js');
				}
				num += 1;
			}).on('end', () => {
				expect(num).to.equal(4);
				done();
			});
			Walker.create(path.resolve(__dirname, 'examples/local'), ['index.html']).pipe(analyzer);
		});

	});

	describe('AST analyzer', () => {

		it('Instantiation with type and configuration', (done) => {
			const analyzer = ASTAnalyzer.create(constants.types.REQUIREJS);
			expect(analyzer.type).to.equal(constants.types.REQUIREJS);
			done();
		});

		it('Ignore non javascript files', (done) => {
			const analyzer = ASTAnalyzer.create().on('data', () => {
				assert(false, 'No data event should be emitted');
			}).on('warn', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.type).not.to.equal(File.types.JAVASCRIPT);
			}).on('end', () => {
				done();
			});
			Walker.create(path.resolve(__dirname, 'examples/local'), ['index.html']).pipe(analyzer);
		});

		it('Get modules from javascript files', (done) => {
			const analyzer = ASTAnalyzer.create().on('data', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.type).to.equal(File.types.JAVASCRIPT);
				expect(file.parents.length).to.be.above(0);
				expect(file.parents[0]).to.be.instanceof(File);
			}).on('end', () => {
				done();
			});
			Walker.create(path.resolve(__dirname, 'examples/local'), ['./*.js']).pipe(analyzer);
		});

		it('Test local HTML index file with all scripts integration modes', (done) => {
			let num = 0;
			const analyzer = ASTAnalyzer.create().on('data', (file) => {
				expect(file).to.be.instanceof(File);
				if (file.name === 'common.js') {
					expect(file.parents.length).to.equal(2);
					expect(file.parents[0].name).to.equal('2.js');
					expect(file.parents[0].parents[0].name).to.equal('index.html');
					expect(file.parents[1].name).to.equal('3.js');
					expect(file.dependencies.length).to.equal(0);
				} else if (file.name === 'module1.js') {
					expect(file.parents.length).to.equal(1);
					expect(file.parents[0].name).to.equal('3.js');
					expect(file.dependencies.length).to.equal(0);
				} else if (file.name === 'module2.js') {
					expect(file.parents.length).to.equal(1);
					expect(file.parents[0].name).to.equal('4.js');
					expect(file.dependencies.length).to.equal(0);
				}
				num += 1;
			}).on('end', () => {
				expect(num).to.equal(10);
				done();
			});
			Walker.create(path.resolve(__dirname, 'examples/local'), ['*.html']).pipe(DOMAnalyzer.create()).pipe(analyzer);
		});

	});

	describe('Bundler', () => {

		it('Instantiation with type and configuration', (done) => {
			const configuration = { foo: 'bar' };
			const analyzer = Bundler.create(constants.types.REQUIREJS, configuration);
			expect(analyzer.type).to.equal(constants.types.REQUIREJS);
			expect(analyzer.configuration).to.deep.equal(configuration);
			done();
		});

		it('Ignore non javascript files', (done) => {
			const analyzer = Bundler.create().on('data', () => {
				assert(false, 'No data event should be emitted');
			}).on('warn', (file) => {
				expect(file).to.be.instanceof(File);
				expect(file.type).not.to.equal(File.types.JAVASCRIPT);
			}).on('end', () => {
				done();
			});
			Walker.create(path.resolve(__dirname, 'examples/local'), ['index.html']).pipe(analyzer);
		});

		it('Empty configuration from single module file', (done) => {
			const bundler = Bundler.create().on('data', (configuration) => {
				expect(configuration).to.be.instanceof(Object);
				expect(configuration).to.be.have.all.keys('bundles');
			}).on('end', () => {
				done();
			});
			Walker.create(__dirname, ['core.js']).pipe(bundler);
		});

	});
});
