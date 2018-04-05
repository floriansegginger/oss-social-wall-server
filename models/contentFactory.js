'use strict';

let Notifier = require('./notifier');
let Content = require('./data/content');

class ContentFactory {
  constructor() {
    this._loadedPlugins = [];
    this._listeners = [];
  }

  loadPlugins(directory, callback) {
    // TODO load all from directory
    var toInitialize = 4;
    var TwitterRetriever = require(directory + '/twitterRetriever');
    var WebappRetriever = require(directory + '/webappRetriever');
    var FacebookRetriever = require(directory + '/facebookRetriever');
    var InstagramRetriever = require(directory + '/instagramRetriever');
    var newTwitterRetriever = new TwitterRetriever();
    var newWebappRetriever = new WebappRetriever();
    var newFacebookRetriever = new FacebookRetriever();
    var newInstagramRetriever = new InstagramRetriever();

    function onPluginLoaded(retriever) {
      this._loadedPlugins.push(retriever);
      retriever.addListener(this);
      toInitialize--;
      if (toInitialize === 0) {
        callback();
      }
    }
    newTwitterRetriever.initialize(onPluginLoaded.bind(this, newTwitterRetriever));
    newWebappRetriever.initialize(onPluginLoaded.bind(this, newWebappRetriever));
    newFacebookRetriever.initialize(onPluginLoaded.bind(this, newFacebookRetriever));
    newInstagramRetriever.initialize(onPluginLoaded.bind(this, newInstagramRetriever));
  }

  removeContentListener(listener) {
    for (var i = this._listeners.length - 1; i >= 0; i--) {
      if (this._listeners[i].listener === listener) {
        for (var j in this._loadedPlugins) {
          if (this._loadedPlugins[j].type === this._listeners[i].filter.type) {
            this._loadedPlugins[j].removeSourceFilter(listener, this._listeners[i].filter);
          }
        }
        this._listeners.splice(i, 1);
      }
    }
  }

  addContentListener(listener, filter, options) {
    var retVal = true;
    for (var i in this._loadedPlugins) {
      if (this._loadedPlugins[i].type === filter.type) {
        retVal &= this._loadedPlugins[i].addSourceFilter(listener, filter, options);
      }
    }
    this._listeners.push({
      listener: listener,
      filter: filter,
      options: options
    });
    return retVal;
  }

  onNotify(type, data) {
    console.log(`[ContentFactory] Got new content. Type = ${type}`);
    var toProcess = 0;    
    for (let i = 0; i < data.length; i++) {
      let content = data[i].content;
      if (type === 'new') {
        // Check if this content doesn't already exist
        // If it does, update it
        Content
          .findOne({'source.id': content.source.id})
          .exec((error, foundContent) => {
            if (foundContent === null && error === null) {
              content.save((error, savedContent) => {
                if (error) {
                  console.error('Invalid new content');
                  console.error(error);
                  return;
                }
                for (var j in this._listeners) {
                  if (JSON.stringify(this._listeners[j].filter) == JSON.stringify(data[i].filter)) {
                    this._listeners[j].listener.onNotify.call(this._listeners[j].listener, 'new', data);
                  }
                }
              });
            }
          });
      }
    }
  }

  getContents(type, filter, options) {
    for (var i in this._loadedPlugins) {
      if (this._loadedPlugins[i].type === type) {
        this._loadedPlugins[i].getContents(filter, options);
      }
    }
  }

  filterToText(type, filter) {
    for (var i in this._loadedPlugins) {
      if (this._loadedPlugins[i].type === type) {
        return this._loadedPlugins[i].constructor.filterToText(filter);
      }
    }
  }

  textToFilter(type, text) {
    for (var i in this._loadedPlugins) {
      if (this._loadedPlugins[i].type === type) {
        return this._loadedPlugins[i].constructor.textToFilter(text);
      }
    }
  }
}

module.exports = exports = new ContentFactory();