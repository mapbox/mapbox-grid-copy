var queue = require('queue-async');
var url = require('url');
var util = require('util');

module.exports = function Copier(opts, source, to, callback) {
  var parallel = !isNaN(opts.parts) && !isNaN(opts.part);

  to.startWriting(function(err) {
    if (err) return callback(err);
    copyGrids(function(err, report) {
      if (err) return callback(err);
      to.stopWriting(callback);
    });
  });

  function copyGrids(finished) {
    var query = 'SELECT zoom_level AS z, tile_column AS x, tile_row AS y FROM grids';
    var statement = source._db.prepare(query, function(err) {
      if (err) return finished(invalid(err));

      var q = queue(opts.concurrency || 1000);
      q.drain = false;
      q.draining = false;
      q.defer(copyGrid);

      function copyGrid(next) {
        if (q.drain && q.draining) return next();

        else if (q.drain) {
          q.draining = true;

          q.awaitAll(function(err) {
            statement.finalize();
            finished(err);
          });

          return next();
        }

        else q.defer(copyGrid);

        statement.get(function(err, row) {
          if (err) return next(err);
          if (!row) {
            q.drain = true;
            return next();
          }

          if (parallel && row.x % opts.parts !== opts.part) return next();

          row.y = (1 << row.z) - 1 - row.y;

          source.getGrid(row.z, row.x, row.y, function(err, data) {
            if (err) {
              if (!err.message.match(/Grid does not exist/)) {
                opts.warn(err);
              }
              return next();
            }

            // Skip any empty grids that TileMill exports.
            if (!Object.keys(data.data).length) return next();

            // Mark buffer as pbf for tilelive-s3 to set proper headers.
            data.format = 'pbf';

            to.putGrid(row.z, row.x, row.y, JSON.stringify(data), function(err) {
              if (err) opts.warn(err);
              return next();
            });
          });
        });
      }
    });
  }
};
