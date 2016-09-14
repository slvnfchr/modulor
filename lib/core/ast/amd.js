
'use strict';

/**
 * AST analyzer utilities functions for AMD/RequireJS modules
 */

const amdetective = require('amdetective');

function traverse(object, visitor) {
	if (!object) return;
	if (visitor.call(null, object) === false) return;
	let child;
	Object.keys(object).forEach((key) => {
		child = object[key];
		if (typeof child === 'object' && child !== null) {
			if (traverse(child, visitor) === false) {
				return false;
			}
		}
		return true;
	});
}

function reverse(object) {
	if (!object || object.type !== 'ObjectExpression') return false;
	const obj = {};
	object.properties.forEach((property) => {
		if (property.value.type === 'ObjectExpression') {
			obj[property.key.name] = reverse(property.value);
		} else {
			obj[property.key.name] = property.value.value;
		}
	});
	return obj;
}

function analyze(ast, nested) {
	let moduleDeps = [];
	const moduleList = [];
	amdetective.parse.recurse(ast, (callName, config, name, deps) => {
		moduleDeps = moduleDeps.concat(deps || []);
		if (name) moduleList.push(name); // named module
		return !!nested;
	});
	return {
		dependencies: moduleDeps.filter((value) => ['require', 'module', 'exports'].indexOf(value) === -1),
		modules: moduleList,
	};
}

function getConfiguration(ast) {
	let configuration = {};
	traverse(ast, (node) => {
		if (node.type === 'CallExpression' &&
			node.callee && node.callee.type === 'MemberExpression' &&
			node.callee.object.type === 'Identifier' && ['requirejs', 'require'].indexOf(node.callee.object.name) !== -1 &&
			node.callee.property.type === 'Identifier' && node.callee.property.name === 'config' &&
			node.arguments.length === 1 && node.arguments[0].type === 'ObjectExpression') {
			configuration = reverse(node.arguments[0]);
			return false;
		}
		return true;
	});
	return configuration;
}

module.exports = {
	getConfiguration,
	analyze,
};
