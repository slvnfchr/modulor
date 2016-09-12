# Modulor

Bundles configuration inference from static files distribution

## Install

```bash
$ npm install modulor
```

## Description

Package is composed of core modules are [streams](https://nodejs.org/api/stream.html) :
- lib/core/walker : file tree traversal through [readdirp](https://github.com/thlorenz/readdirp)
- lib/core/dom : DOM parser for scripts entries detection through [jsdom](https://github.com/tmpvar/jsdom)
- lib/core/ast : AST parser for shared & conditionnal modules detection through [amdetective](https://github.com/mixu/amdetective)

All streams chunks are / should be of instances of lib/core/file