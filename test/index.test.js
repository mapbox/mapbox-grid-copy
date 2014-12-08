var test = require('tape');
var path = require('path');
var crypto = require('crypto');
var s3prefixed = require('s3prefixed');
var s3urls = require('s3urls');
var AWS = require('aws-sdk');
var split = require('split');
var exec = require('child_process').exec;
var gridCopy = require('..');

var bucket = process.env.TestBucket || 'tilestream-tilesets-development';

test('does not copy tiles', function(t) {
  var fixture = path.resolve(__dirname, 'fixtures', 'valid.tiles.mbtiles');
  var url = [
    's3:/',
    bucket,
    '{prefix}/_grid-tests',
    crypto.randomBytes(16).toString('hex'),
    'tiles/{z}/{x}/{y}'
  ].join('/');

  gridCopy(fixture, url, function(err) {
    t.deepEqual(err, { code: 'NOGRIDS' }, 'expected no grids');
    gridCount(url, function(err, count) {
      t.ifError(err, 'counted grids');
      t.equal(count, 0, 'no grids written');
      t.end();
    });
  });
});

test('copies grids', function(t) {
  var fixture = path.resolve(__dirname, 'fixtures', 'valid.grids.mbtiles');
  var url = [
    's3:/',
    bucket,
    '{prefix}/_grid-tests',
    crypto.randomBytes(16).toString('hex'),
    'grids/{z}/{x}/{y}'
  ].join('/');

  gridCopy(fixture, url, function(err) {
    t.ifError(err, 'copied grids');
    gridCount(url, function(err, count) {
      t.ifError(err, 'counted grids');
      t.equal(count, 4, 'all grids written');
      t.end();
    });
  });
});

test('executable copies grids', function(t) {
  var fixture = path.resolve(__dirname, 'fixtures', 'valid.grids.mbtiles');
  var cmd = path.resolve(__dirname, '..', 'bin', 'mapbox-grid-copy.js');
  var url = [
    's3:/',
    bucket,
    '{prefix}/_grid-tests',
    crypto.randomBytes(16).toString('hex'),
    'grids.exe/{z}/{x}/{y}'
  ].join('/');

  exec([ cmd, fixture, url ].join(' '), function(err, stdout, stderr) {
    t.ifError(err, 'copied grids');
    t.equal(stdout, 'Copied grids to S3!\n', 'expected stdout');
    t.equal(stderr, '', 'no stderr');
    gridCount(url, function(err, count) {
      t.ifError(err, 'counted grids');
      t.equal(count, 4, 'all grids written');
      t.end();
    });
  });
});

test('executable copies grids silently', function(t) {
  var fixture = path.resolve(__dirname, 'fixtures', 'valid.grids.mbtiles');
  var cmd = path.resolve(__dirname, '..', 'bin', 'mapbox-grid-copy.js');
  var url = [
    's3:/',
    bucket,
    '{prefix}/_grid-tests',
    crypto.randomBytes(16).toString('hex'),
    'grids.slient.exe/{z}/{x}/{y}'
  ].join('/');

  exec([ cmd, fixture, url, '--quiet' ].join(' '), function(err, stdout, stderr) {
    t.ifError(err, 'copied grids');
    t.equal(stdout, '', 'no stdout');
    t.equal(stderr, '', 'no stderr');
    gridCount(url, function(err, count) {
      t.ifError(err, 'counted grids');
      t.equal(count, 4, 'all grids written');
      t.end();
    });
  });
});

test('executable copies handles no grids silently', function(t) {
  var fixture = path.resolve(__dirname, 'fixtures', 'valid.tiles.mbtiles');
  var cmd = path.resolve(__dirname, '..', 'bin', 'mapbox-grid-copy.js');
  var url = [
    's3:/',
    bucket,
    '{prefix}/_grid-tests',
    crypto.randomBytes(16).toString('hex'),
    'tiles.exe/{z}/{x}/{y}'
  ].join('/');

  exec([ cmd, fixture, url, '--quiet' ].join(' '), function(err, stdout, stderr) {
    t.ifError(err, 'copied grids');
    t.equal(stdout, '', 'no stdout');
    t.equal(stderr, '', 'no stderr');
    gridCount(url, function(err, count) {
      t.ifError(err, 'counted grids');
      t.equal(count, 0, 'no grids written');
      t.end();
    });
  });
});

function gridCount(s3url, callback) {
  var s3 = new AWS.S3();
  var count = 0;

  var params = s3urls.fromUrl(s3url);
  s3prefixed.ls(params.Bucket, params.Key.replace('{z}/{x}/{y}', ''))
    .pipe(split())
    .on('data', function(d) { if (d) count++; })
    .on('end', function() { callback(null, count); })
    .on('error', function(err) { callback(err); });
}
