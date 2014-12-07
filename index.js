var MBTiles = require('mbtiles');
var S3 = require('tilelive-s3');
var tilelive = require('tilelive');
var copy = require('../lib/copy');
var queue = require('queue-async');
var s3urls = require('s3urls');

MBTiles.registerProtocols(tilelive);
S3.registerProtocols(tilelive);

module.exports = function(filepath, s3url, options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }

  s3url = s3urls.convert(s3url, 's3');

  var q = queue(1);
  var mbtiles, s3, grids, warnings = [];

  q.defer(function(next) {
    new MBTiles(filepath, function(err, src) {
      if (err) return next(err);
      mbtiles = s3;
      next();
    });
  });

  q.defer(function(next) {
    new S3(s3url, function(err, dst) {
      if (err) return next(err);
      s3 = dst;
      next();
    });
  });

  q.defer(function(next) {
    mbtiles._db.get('SELECT COUNT(1) AS count, MAX(LENGTH(grid)) AS size, zoom_level as z FROM grids', function(err, row) {
      if (err && err.code === 'SQLITE_CORRUPT') return next(invalid(err));
      if (fatal(err)) return next(err);
      if (!row || !row.count) return next({ code: 'NOGRIDS' });
      grids = row.count;
      next();
    });
  });

  q.defer(function(next) {
    var opts = {
      part: options.part,
      parts: options.parts,
      s3url: s3url,
      gridCount: grids,
      warn: function(msg) {
        if (options.logStream) options.logStream.write(msg);
      },
      concurrency: options.concurrency || Math.ceil(require('os').cpus().length * 16),
      batchsize: options.batchsize || 10e3
    };

    copy(opts, mbtiles, s3, next);
  });

  q.await(callback);
};

function fatal(err) {
  if (!err) return;
  if (err && err.code === 'SQLITE_ERROR' && err.message.indexOf('no such table') >= 0)
    return { code: 'NOGRIDS' };
  return err;
}

function invalid(message) {
  var err = message instanceof Error ? message : new Error(message);
  err.code = 'EINVALID';
  return err;
}
