jQuery(function($){
  var API_URL = "/files/";

  var File = Backbone.Model.extend({});

  var FileCollection = Backbone.Collection.extend({
    model: File
  });

  var FileView = Backbone.View.extend({
    tagName: 'li',
    events: {
      'click span.remove': 'remove'
    },
    initialize: function() {
      _.bindAll(this, 'render', 'unrender', 'remove');

      this.model.bind('remove', this.unrender);
    },
    render: function(){
      var tpl = '<div class="file_row">' +
                '<span class="name"><%= fileName %></span>' +
                '<span class="remove">X</span>' +
                '</div>';
      $(this.el).html(_.template(tpl, this.model.attributes));
      return this;
    },
    unrender: function(){
      $(this.el).remove();
    },
    remove: function(){
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
