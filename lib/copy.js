var Queue = require('./queue');
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
        var offset = 0;
        var marker = opts.s3url + '/grids-offset.info';
        var total = opts.gridCount;
        var c = new Queue(function(t, done) {
            if (parallel && t.x % opts.parts !== opts.part) return done();

            source.getGrid(t.z, t.x, t.y, function(err, data) {
                if (err) {
                    if (!err.message.match(/Grid does not exist/)) {
                        opts.warn(err);
                    }
                    return done();
                }
                // Skip any empty grids that TileMill exports.
                if (!Object.keys(data.data).length) {
                    return done();
                }
                // Mark buffer as pbf for tilelive-s3 to set proper headers.
                data.format = 'pbf';

                to.putGrid(t.z, t.x, t.y, data, function(err) {
                    if (err) opts.warn(err);
                    return done();
                });
            });
        }, opts.concurrency);
        c.on('empty', function() {
            to.put(url.parse(marker).pathname, offset.toString(), {
                'x-amz-acl': 'public-read',
                'Connection': 'keep-alive',
                'Content-Length': offset.toString().length,
                'Content-Type': 'text/plain'
            }, function(err) {
                if (err) return finished(err);
                source._db.all('SELECT zoom_level AS z, tile_column AS x, tile_row AS y FROM grids LIMIT ' + opts.batchsize + ' OFFSET ' + offset, function(err, rows) {
                    if (err) return finished(invalid(err));
                    if (!rows.length) return finished();
                    for (var i = 0; i < rows.length; i++) {
                        // Flip Y coordinate because MBTiles files are TMS.
                        rows[i].y = (1 << rows[i].z) - 1 - rows[i].y;
                        c.add(rows[i]);
                    }
                    offset += opts.batchsize;
                });
            });
        });
        to.get(marker, function(err, data) {
            if (err && err.status !== 403 && err.status !== 404) return finished(err);
            if (parseInt(data, 10)) {
                offset = parseInt(data, 10);
                opts.warn(util.format('Resuming from %s/%s', offset, total));
            } else {
                offset = 0;
            }
            c.emit('empty');
        });
    }
};
