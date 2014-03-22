var AWS = require('aws-sdk');

/*
 * Update aws configuration
 */
exports.configure = function(config) {
  AWS.config.update(config.aws);
}

/*
 * retrieve list of files
 */

exports.list = function(req, res){
  res.send("LIST");
};

/*
 * upload new file
 */

exports.create = function(req, res){
  res.send("CREATE");
};


/*
 * retrieve single file for download
 */

exports.read = function(req, res){
  var fileId = req.params.id;
  res.send("READ");
};

/*
 * remove single file
 */

exports.delete = function(req, res){
  var fileId = req.params.id;
  res.send("DELETE");
};
