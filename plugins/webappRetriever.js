let mongoose = require('mongoose');

let config = require(__dirname + '/../config.js');
let ContentRetriever = require(__dirname + '/../models/contentRetriever');
let Content = require(__dirname + '/../models/data/content');

let WebappPost = mongoose.model('WebappPost');

class WebappRetriever extends ContentRetriever {
  constructor() {
    super();
    this.type = "webapp";
  }

  initialize(callback) {
    WebappPost.addListener(this);
    process.nextTick(callback);
  }

  onNotify(type, data) {
    var newContent = new Content();
    newContent.text = data.text;
    newContent.author = {
      name: data.username,
      url: '',
      photo: '',
    };
    newContent.date = data.date;
    newContent.source = {
      type: 'webapp',
      url: '',
      id: data._id.toString()
    };
    if (data.media && data.media.type) {
      newContent.media = [{
        type: data.media.type,
        url: data.media.url
      }];
    }

    var wrapper = {
      filter: {
        type: 'webapp',
        parameters: {
          event: data.event.toString()
        }
      },
      content: newContent
    };

    console.log(JSON.stringify(wrapper, '', 4));
    this._notifyListeners('new', [wrapper]);
  }

  addSourceFilter(listener, filter, options) {
    // Do nothing
  }

  removeSourceFilter(listener, filter) {
    // Do nothing
  }

  getContents(filter, options) {
    var dateStart = options.dateStart;
    var dateEnd = options.dateEnd;
    WebappPost
    .find({
      event: filter.parameters.event,
      $and: [
        {date: {$gte: dateStart}},
        {date: {$lte: dateEnd}}
      ]
    })
    .exec((error, posts) => {
      if (error) {
        throw error;
      }
      for (var i = 0; i < posts.length; i++) {
        onNotify('get', posts[i]);
      }
    });
  }
}

module.exports = exports = WebappRetriever;