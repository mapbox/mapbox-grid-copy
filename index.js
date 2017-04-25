var MBTiles = require('@mapbox/mbtiles');
var S3 = require('@mapbox/tilelive-s3');
var tilelive = require('@mapbox/tilelive');
var gridCopy = require('./lib/grid-copy');
var queue = require('queue-async');
var s3urls = require('s3urls');

MBTiles.registerProtocols(tilelive);
S3.registerProtocols(tilelive);

module.exports = function(filepath, s3url, options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }

  s3url = /\.grid\.json$/.test(s3url) ? s3url.slice(0, -10) : s3url;

  var q = queue(1);
  var mbtiles, s3, grids, warnings = [];

  q.defer(function(next) {
    tilelive.load('mbtiles://' + filepath, function(err, src) {
      if (err) return next(err);
      mbtiles = src;
      next();
    });
  });

  q.defer(function(next) {
    tilelive.load(s3urls.convert(s3url, 's3'), function(err, dst) {
      if (err) return next(err);
      s3 = dst;
      s3.data.grids = [
        s3urls.convert(s3url, 'bucket-in-host').replace('https:', 'http:') + '.grid.json'
      ];
      next();
    });
  });

  q.defer(function(next) {
    mbtiles._db.get('SELECT COUNT(*) AS count FROM grids', function(err, row) {
      if (err && err.code === 'SQLITE_CORRUPT') return next(invalid(err));
      if (fatal(err)) return next(fatal(err));
      if (!row || !row.count) return next({ code: 'NOGRIDS' });
      grids = row.count;
      next();
    });
  });

  q.defer(function(next) {
    var url = s3urls.convert(s3url, 'bucket-in-host')
      .replace('https:', 'http:')
      .split('/').reduce(function(memo, bit) {
        if (bit !== '{z}' && bit !== '{x}' && bit !== '{y}') memo.push(bit);
        return memo;
      }, []).join('/');

    var opts = {
      part: options.part,
      parts: options.parts,
      s3url: url,
      gridCount: grids,
      warn: function(msg) {
        if (options.logStream) options.logStream.write(msg.toString() + '\n');
      },
      concurrency: options.concurrency || Math.ceil(require('os').cpus().length * 16),
      batchsize: options.batchsize || 10e3
    };

    gridCopy(opts, mbtiles, s3, next);
  });

  q.await(function(err) {
    mbtiles.close(function() {
      callback(err);
    });
  });
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
