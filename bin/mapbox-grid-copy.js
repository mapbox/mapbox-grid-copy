#!/usr/bin/env node

var args = require('minimist')(process.argv.slice(2));
var path = require('path');
var gridCopy = require('..');

if (args._.length < 2) {
  console.error('Must provide a source mbtiles file and a destination S3 URL');
  process.exit(1);
}

var options = {};
if (!isNaN(parseFloat(args.part))) options.part = args.part;
if (!isNaN(parseFloat(args.parts))) options.parts = args.parts;
if (!isNaN(parseFloat(args.concurrency))) options.concurrency = args.concurrency;
if (!isNaN(parseFloat(args.batchsize))) options.batchsize = args.batchsize;
if (!args.quiet) options.logStream = process.stdout;

gridCopy(path.resolve(args._[0]), args._[1], options, function(err) {
  if (err && err.code === 'EINVALID') {
    console.error(err);
    process.exit(3);
  }

  if (err && err.code === 'NOGRIDS') {
    if (!args.quiet) console.log('No grids to copy');
    process.exit(0);
  }

  if (err) {
    console.error(err);
    process.exit(1);
  }

  if (!args.quiet) console.log('Copied grids to S3!');
  process.exit(0);
});
