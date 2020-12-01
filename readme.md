# mapbox-grid-copy

[![Build Status](https://travis-ci.com/mapbox/mapbox-grid-copy.svg?branch=master)](https://travis-ci.com/mapbox/mapbox-grid-copy)

Copy UTFGrids from mbtiles files to S3

## Usage in Javascript

```javascript
var gridCopy = require('mapbox-grid-copy');
var mbtiles = '/path/to/my.mbtiles';
var s3 = 's3://my-bucket/key/{z}/{x}/{y}';
var options = {};

gridCopy(mbtiles, s3, options, function(err) {
  if (err && err.code === 'EINVALID')
    return console.error('The mbtiles file was invalid');
  if (err && err.code === 'NOGRIDS')
    return console.error('There were no grids in the mbtiles file');
  if (err)
    return console.error(err);
  console.log('Success!');
});
```

`options` may include:
- parts: processing parallelism
- part: which parallel part to process
- concurrency: number of concurrent PUT requests to S3
- batchsize: number of grids to pull from mbtiles into memory at a time

## Usage in shell scripts

```sh
$ npm install -g mapbox-grid-copy
$ mapbox-grid-copy "/path/to/mb.mbtiles" "s3://my-bucket/key/{z}/{x}/{y}"
```

You may optionally pass any of the `options` described via flags. For example:
```sh
$ mapbox-grid-copy --parts 12 --part 4 \
    "/path/to/mb.mbtiles" \
    "s3://my-bucket/key/{z}/{x}/{y}"
```

The script will exit with the following codes:
- `0`: successfully completed or there were no grids to copy
- `1`: an unexpected error occurred
- `3`: the mbtiles file was invalid

## Tests

Tests actually put sample grids to S3. Make sure that your shell is authenticated with valid AWS credentials.

You can bring your own bucket by specifying a `TestBucket` environment variable before running the test script. Otherwise, the script will attempt to put grids to a private Mapbox bucket.

```
npm test
```
