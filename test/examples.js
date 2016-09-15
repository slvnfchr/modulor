
'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const modulor = require('../lib/index');

function sanitize(filepath) {
	const data = fs.readFileSync(filepath, 'utf8');
	const result = data.replace(/([^\s:]+):/gi, (key) => `"${key.replace(/:$/, '')}":`) // encapsulate keys in double quotes
		.replace(/'/gi, '"') // replace single quotes by double quotes
		.replace(/\/\/[^\n]+/gi, ''); // remove comments
	return JSON.parse(result);
}

describe('Examples', () => {

	it('Local example', (done) => {
		modulor(path.resolve(__dirname, 'examples/local'), ['*.html']).on('data', (configuration) => {
			const bundles = [
				{
					name: './lib/common',
					include: [],
				},
				{
					name: '2.js',
					include: [],
				},
				{
					name: '3.js',
					include: ['./lib/module1'],
				},
				{
					name: '4.js',
					include: ['./lib/module2'],
				},
			];
			expect(configuration.bundles).to.deep.equal(bundles);
		}).on('end', () => {
			done();
		});
	});

	it('RequireJS multipage example', (done) => {
		modulor(path.resolve(__dirname, 'examples/requirejs-multipage/www')).on('data', (configuration) => {
			const target = sanitize(path.resolve(__dirname, 'examples/requirejs-multipage/tools/build.js'));
			expect(configuration.modules).to.deep.equal(target.modules);
		}).on('end', () => {
			done();
		});
	});

});
