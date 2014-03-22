var AWS = require('aws-sdk');
var rclient = require('redis').createClient();
var formidable = require('formidable');

// constants
var NEXT_ID = "nextFileId";
var FILES = "file";
var GROUP = "files";


var handleError = function (err) {
  console.error("error response - " + err);
  jsonResponse({"error": err});
}

var jsonResponse = function (res, reply) {
  res.writeHead(200, { 'Content-Type': 'application/json'});
  res.end(JSON.stringify(reply));
}

var toFileKey = function(fileId) {
  return FILES + ":" + fileId;
}


/*
 * module configuration
 */
exports.configure = function(config) {
  AWS.config.update(config.aws);
}

/*
 * retrieve list of files
 */

exports.list = function(req, res) {
  var files = [];
  rclient.lrange(GROUP, 0, -1, function(err, fileIds) {
    if (err) {
      handleError(err);
    }
    var multi = rclient.multi();
    fileIds.map(function (fileId) {
      multi.hget(fileId, "filename");
    });
    multi.exec(function (err, replies) {
      if (err) {
        handleError(err);
      }
      replies.forEach(function (fileName, index) {
        files.push({
          fileId: fileIds[index].replace(toFileKey(''), ''),
          fileName: fileName
        });
      });
      jsonResponse(res, files);
    })
  });
};

/*
 * upload new file
 */

exports.create = function(req, res) {
  var form = new formidable.IncomingForm();
  var fileInfo = {};
  form.on('file', function (name, file) {
    fileInfo = file;
    // TODO: upload to s3
  });
  form.on('aborted', function() {
    // TODO:
    console.log("ABORTED");
  });
  form.on('error', function(err) {
      handleError(err);
  });
  form.on('end', function () {
    var fileName = fileInfo.name;
    // insert to redis
    rclient.incr(NEXT_ID);
    rclient.get(NEXT_ID, function(err, fileId) {
      if (err) {
        handleError(err);
      }
      // create file entry
      var fileKey = toFileKey(fileId);
      // insert file to hash
      rclient.hset(fileKey, "filename", fileName,function(err, replies) {
        if (err) {
          handleError(err);
        }
        // add file to list
        rclient.rpush(GROUP, fileKey, function(err, reply) {
          if (err) {
            handleError(err);
          }
          jsonResponse(res, {
            fileId: fileId,
            fileName: fileName
          });
        });
      });
    });
  });
  form.parse(req);
};


/*
 * retrieve single file for download
 */

exports.read = function(req, res) {
  var fileId = toFileKey(req.params.id);
  // retrieve filename
  rclient.hget(fileId, "filename", function (err, fileName) {
    if (err) {
      handleError(err);
    }
    // TODO: stream file from s3
    jsonResponse(res, {
      fileId: fileId,
      fileName: fileName
    });
  })
};

/*
 * remove single file
 */

exports.delete = function(req, res) {
  var fileId = toFileKey(req.params.id);
  // remove file
  rclient.hdel(fileId, "filename", function(err, replies) {
    if (err) {
      handleError(err);
    }
    // TODO: remove file from s3
    // remove file from list
    rclient.lrem(GROUP, 0, fileId, function(err, reply) {
      if (err) {
        handleError(err);
      }
      res.send('');
    });
  })
};
