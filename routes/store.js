var AWS = require('aws-sdk');
var rclient = require('redis').createClient();
var formidable = require('formidable');
var fs = require('fs');

// constants
var NEXT_ID = "nextFileId";
var FILES = "file";
var GROUP = "files";

// content haskKeys
var NAME_KEY = "filename";
var SIZE_KEY = "filesize";

// amazon s3 object
var s3;

// convenience function to handle errors
var handleError = function (res, err) {
  console.error("error response - " + err);
  jsonResponse(res, {"error": err});
}

// convenience function to respond with JSON
var jsonResponse = function (res, reply) {
  res.writeHead(200, { 'Content-Type': 'application/json'});
  res.end(JSON.stringify(reply));
}

// convenience function to create file key string
var toFileKey = function(fileId) {
  return FILES + ":" + fileId;
}

// store configuration
var settings = {};

/*
 * module configuration
 */
exports.configure = function(config) {
  settings = config;
  // configure AWS
  AWS.config.update(config.aws);
  s3 = new AWS.S3();
}

/*
 * retrieve list of files
 */
exports.list = function(req, res) {
  var files = [];
  rclient.lrange(GROUP, 0, -1, function(err, fileIds) {
    if (err) {
      handleError(res, err);
    }
    var multi = rclient.multi();
    fileIds.map(function (fileId) {
      multi.hmget([fileId, NAME_KEY, SIZE_KEY]);
    });
    multi.exec(function (err, replies) {
      if (err) {
        handleError(res, err);
      }
      replies.forEach(function (data, index) {
        files.push({
          fileId: fileIds[index].replace(toFileKey(''), ''),
          fileName: data[0],
          fileSize: data[1]
        });
      });
      jsonResponse(res, files);
    })
  });
};

/*
 * create new file
 */
exports.create = function(req, res) {
  var form = new formidable.IncomingForm();
  var fileInfo = {};
  form.on('file', function (name, file) {
    fileInfo = file;
  });
  form.on('error', function(err) {
      handleError(res, err);
  });
  form.on('end', function () {
    saveFile(res, fileInfo);
  });
  form.parse(req);
};

/*
 * upload file to s3 and save to redis
 */
var saveFile = function (res, fileInfo) {
  var fileName = fileInfo.name;
  var fileSize = fileInfo.size;
  var fileBuffer = fs.readFileSync(fileInfo.path);
  // insert to redis
  rclient.incr(NEXT_ID);
  rclient.get(NEXT_ID, function(err, id) {
    if (err) {
      handleError(res, err);
    }
    var fileId = toFileKey(id);
    // upload to s3
    s3.putObject({
      ACL: 'public-read',
      Bucket: settings.aws.bucketName,
      Key: fileId,
      Body: fileBuffer,
      ContentType: getContentTypeByFile(fileName)
    }, function(error, response) {
      if (error) {
        handleError(res, error);
      }
      // insert file to hash
      rclient.hmset([fileId,
                     NAME_KEY, fileName,
                     SIZE_KEY, fileSize], function(err, replies) {
        if (err) {
          handleError(res, err);
        }
        // add file to list
        rclient.rpush(GROUP, fileId, function(err, reply) {
          if (err) {
            handleError(res, err);
          }
          jsonResponse(res, {
            fileId: id,
            fileName: fileName,
            fileSize: fileSize
          });
        });
      });
    });
  });
};

/*
 * retrieve content type of file given filename
 */
function getContentTypeByFile(fileName) {
  var rc = 'application/octet-stream';
  var fNameLower = fileName.toLowerCase();

  if (fNameLower.indexOf('.html') >= 0) rc = 'text/html';
  else if (fNameLower.indexOf('.css') >= 0) rc = 'text/css';
  else if (fNameLower.indexOf('.json') >= 0) rc = 'application/json';
  else if (fNameLower.indexOf('.js') >= 0) rc = 'application/x-javascript';
  else if (fNameLower.indexOf('.png') >= 0) rc = 'image/png';
  else if (fNameLower.indexOf('.jpg') >= 0) rc = 'image/jpg';

  return rc;
}


/*
 * retrieve single file for download
 */
exports.read = function(req, res) {
  var fileId = toFileKey(req.params.id);
  // retrieve filename
  rclient.hmget([fileId, NAME_KEY, SIZE_KEY], function (err, fileInfo) {
    if (err) {
      handleError(res, err);
    }
    var fileName = fileInfo[0],
        fileSize = fileInfo[1]
    // stream file from s3 to user
    var params = {
      Bucket: settings.aws.bucketName,
      Key: fileId
    };
    var stream = s3.getObject(params).createReadStream();
    res.setHeader('Content-Type', getContentTypeByFile(fileName));
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
    stream.pipe(res);
  });
};

/*
 * remove single file
 */
exports.delete = function(req, res) {
  var fileId = toFileKey(req.params.id);
  // remove file
  rclient.hdel([fileId, NAME_KEY, SIZE_KEY], function(err, replies) {
    if (err) {
      handleError(res, err);
    }
    // remove file from s3
    s3.deleteObject({
      Bucket: settings.aws.bucketName,
      Key: fileId,
    }, function(err, response) {
      if (err) {
        handleError(res, err);
      }
      // remove file from list
      rclient.lrem(GROUP, 0, fileId, function(err, reply) {
        if (err) {
          handleError(res, err);
        }
        res.send('');
      });
    });
  });
};
