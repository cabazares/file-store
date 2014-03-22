jQuery(function($){
  var API_URL = "/files/";

  var File = Backbone.Model.extend({});

  var FileCollection = Backbone.Collection.extend({
    model: File
  });

  var FileView = Backbone.View.extend({
    tagName: 'li',
    events: {
      'click span.remove': 'remove',
      'click div.name': 'download'
    },
    initialize: function() {
      _.bindAll(this, 'render', 'unrender', 'remove', 'download');
      this.model.bind('remove', this.unrender);
    },
    getFileSizeString: function (fileSizeInBytes) {
      var i = -1;
      var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
      do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
      } while (fileSizeInBytes > 1024);
      return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
  },
    render: function(){
      var tpl = '<div class="file_row">' +
                '<div class="name"><%= fileName %></div>' +
                '<div class="size"><%= fileSize %></div>' +
                '<span class="remove">X</span>' +
                '</div>';
      var model = this.model;
      $(this.el).html(_.template(tpl, {
        fileName: model.get("fileName"),
        fileSize: this.getFileSizeString(model.get("fileSize"))
      }));
      return this;
    },
    unrender: function() {
      $(this.el).remove();
    },
    download: function () {
      window.location = API_URL + this.model.get("fileId");
    },
    remove: function() {
      var self = this;
      $.ajax({
        url: API_URL + this.model.get("fileId"),
        type: 'DELETE'
      }).done(function (data) {
        self.model.destroy();
      });
    }
  });

  var ListView = Backbone.View.extend({
    el: $('body'),
    initialize: function(){
      _.bindAll(this, 'retrieveAllFiles', 'addFile', 'appendItem');

      this.collection = new FileCollection();
      this.collection.bind('add', this.appendItem);

      var self = this;
      // initialize uploader
      $('#uploader').fileupload({
        dataType: 'json',
        progressall: function (e, data) {
          // TODO: show progress
          var progress = parseInt(data.loaded / data.total * 100, 10);
          console.log(progress);
        },
        done: function (e, data) {
          self.addFile(data.result);
        }
      });

      // load initial data
      this.retrieveAllFiles();
    },
    retrieveAllFiles: function () {
      var self = this;
      $.get(API_URL).done(function (data) {
        _.each(data, function (file) {
          self.collection.add(file);
        });
      });
    },
    addFile: function(data){
      var file = new File(data);
      this.collection.add(file);
    },
    appendItem: function(file){
      var fileView = new FileView({
        model: file
      });
      $('#files_list').append(fileView.render().el);
    }
  });

  var listView = new ListView();
});
