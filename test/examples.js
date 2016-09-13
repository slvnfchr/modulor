
'use strict';

const expect = require('chai').expect;
const path = require('path');
const modulor = require('../lib/index');

describe('Examples', () => {

	it('Local example', (done) => {
		modulor(path.resolve(__dirname, 'examples/local'), ['*.html']).on('data', (configuration) => {
			const target = {
				paths: {
					'./lib/module1': '3.js',
					'./lib/module2': '4.js',
				},
				bundles: [
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
				],
			};
			expect(configuration).to.deep.equal(target);
		}).on('end', () => {
			done();
		});
	});

});
