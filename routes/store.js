var AWS = require('aws-sdk');

/*
 * Update aws configuration
 */
exports.configure = function(config) {
    AWS.config.update(config.aws);
}

/*
 * GET example.
 */

exports.list = function(req, res){
  res.send("respond with a resource");
};
