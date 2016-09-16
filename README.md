# Modulor

Bundles configuration inference from static files distribution

## Install

```bash
$ npm install modulor
```

## Description

This package is composed of core classes based on node core [streams](https://nodejs.org/api/stream.html) :
- **Walker** (lib/core/walker) : file tree traversal stream (through [readdirp](https://github.com/thlorenz/readdirp))
- **DOMAnalyzer** (lib/core/dom) : DOM analyzer for scripts entries and file distribution detection (through [jsdom](https://github.com/tmpvar/jsdom))
- **ASTAnalyzer** (lib/core/ast) : AST analyzer for shared & conditionnal modules detection (through [amdetective](https://github.com/mixu/amdetective))
- **Bundler** (lib/core/bundler) : modules registry analyzer and configuration inferrer

All streams chunks are / should be of instances of **File** class (lib/core/file) which rely on [mime-types](https://github.com/jshttp/mime-types) module for file types.
Streams chunks are tested according to this rule and streams may emit _warn_ events in case of error / wrong pipelining.  

## Usage

### modulor(source)

This method creates a stream that traverse `source` folder and emit a `data` event with inferred `configuration`. 
It is composed of a **Walker**, a **DOMAnalyzer**, a **ASTAnalyzer** and a **Bundler** stream piped together (see below).

```js
modulor(source).on('data', function (configuration) {
    // ...
})
```

The emitted `configuration` object is formatted according to the detected file distribution type.
By default, the object has the following structure : 
- bundles : array with for each bundle :
	- name : bundle ID
	- include : array of packaged modules' IDs

### modulor.types

This file distribution types :
- modulor.types.REQUIREJS for RequireJS
- ...

### modulor.File.create(properties)

This method creates a file object with the following `properties` JSON object :
- root : the root path of the distribution the file belongs to
- path : the path of the file relative to the distribution's root
- fullPath : the full path of the file
- type : the mimetype of the file (File.types.HTML or File.types.JAVASCRIPT)
- name : the name of the file (filename or module ID)
- parents : array with parents files (HTML for javascript files, parent module for modules)
- dependencies : array with dependencies files (javascript integrated file for HTML, submodules for modules/javascript)

All properties are optionnal

### modulor.Walker.create(source, filter)

This method creates a readeable stream that traverse a given `source` path and emit each file matching the `filter` globs. 
This a wrapper around [readdirp](https://github.com/thlorenz/readdirp) module.

```js
modulor.Walker.create(source, filter)
  .on('data', function (file) {
      // ...
  })
  .on('end', function () {
      // ...
  })
```

### modulor.DOMAnalyzer.create()

This method creates a Document Object Model (DOM) analyzer in the form of a transform stream that take `file` input chunks with type File.types.HTML and emit all linked javascript files as `file` chunks with type File.types.JAVASCRIPT
The stream has a _type_ property (with a _modulor.types.*_ value) 

```js
modulor.DOMAnalyzer.create()
  .on('data', function (file) {
      // ...
  })
  .on('warn', function (file) {
      // event emitted if file is not a File instance 
      // or its type property is not File.types.HTML
      // ...
  })
  .on('end', function () {
      // ...
  })
```

### modulor.ASTAnalyzer.create(type)

This method creates an Abstract Syntax Tree (AST) analyzer in the form of a transform stream that take `file` input chunks with type File.types.JAVASCRIPT and emit all modules as chunks of the same type.
By default, the stream reads the _type_ property of its source stream and has a _configuration_ property corresponding to this file distribution type configuration.
The optionnal `type` parameter is used to force distribution type if the stream is not piped with a DOMAnalyzer stream. 

```js
modulor.ASTAnalyzer.create(type)
  .on('data', function (file) {
      // ...
  })
  .on('warn', function (file) {
      // event emitted if file is not a File instance
      // or its type property is not File.types.JAVASCRIPT
      // ...
  })
  .on('end', function () {
      // ...
  })
```

### modulor.Bundler.create(type, configuration)

This method creates a transform stream that take `file` input chunks with type File.types.JAVASCRIPT and emit the inferred configuration.
The stream reads the _type_ and _configuration_ properties of its source stream.
The optionnal `type` and `configuration` parameters are used to force the file distribution's type and configuration if the stream is not piped with a ASTAnalyzer stream.

```js
modulor.Bundler.create(type, configuration)
  .on('data', function (configuration) {
      // ...
  })
  .on('warn', function (file) {
      // event emitted if file is not a File instance
      // or its type property is not File.types.JAVASCRIPT
      // ...
  })
  .on('end', function () {
      // ...
  })
```
