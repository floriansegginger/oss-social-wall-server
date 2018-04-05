let moment = require('moment');
let bigInt = require('big-integer');
let graph = require('fbgraph');

let config = require(__dirname + '/../config.js');
let ContentRetriever = require(__dirname + '/../models/contentRetriever');
let Content = require(__dirname + '/../models/data/content');

const refreshInterval = 30 * 1000;
const supportedTypes = ['status', 'photo', 'video', 'link', 'event'];
const eventUrlRegexp = /^(https?:\/\/)?(www.)?facebook.com\/events\/([A-z0-9_\-]+)\/?/i;
const fetchFields = 'attachments,from{picture,name},picture,message,type,created_time,permalink_url,source';

class FacebookRetriever extends ContentRetriever {
  constructor() {
    super();
    this.type = "facebook";
    this._filters = [];
    this._filterInfos = {};
  }

  initialize(callback) {
    graph.setAccessToken(config.facebook.appToken);
    graph.setVersion('2.8');
    process.nextTick(callback);
    this._lastUpdate = new Date(0);
    this._updateInterval = setInterval(this._getNewContent.bind(this), refreshInterval);
    // setTimeout(this._getNewContent.bind(this), 5000);
  }

  removeSourceFilter(listener, filter) {
    for (var i in this._filters) {
      if ( this._filters[i].listener === listener 
            && this._filters[i].filter.parameters.url == filter.parameters.url) {
        this._filters.splice(i, 1);
        if (typeof this._filterInfos[filter.url] !== 'undefined') {
          delete this._filterInfos[filter.url];
        }
        break;
      }
    }
  }

  addSourceFilter(listener, filter, options) {
    var dateStart = options.dateStart;
    var dateEnd = options.dateEnd;
    // Do not add duplicate hashtags
    for (var i in this._filters) {
      if (this._filters[i].filter.parameters.url == filter.parameters.url
        && this._filters[i].listener === listener) {
        return;
      }
    }
    this._filters.push({
      listener: listener, 
      filter: filter, 
      dateStart: dateStart,
      dateEnd: dateEnd
    });
  }

  getContents(filter, options) {
    var dateStart = options.dateStart;
    var dateEnd = options.dateEnd;
    if (typeof this._filterInfos[filter.parameters.url] === 'undefined') {
      this._getFilterInfos(filter, (error) => {
        if (!error) {
          this.getContents(filter, options);
        }
      });
      return;
    }
    var filterInfo = this._filterInfos[filter.parameters.url];

    var now = new Date();

    this._getPaginatedResults(filterInfo.id + '/feed', {
      fields: fetchFields,
      since: Math.floor(dateStart.getTime() / 1000),
      until: Math.floor(dateEnd.getTime() / 1000)
    }, (err, results) => {
      if (err) {
        console.error(`[FacebookRetriever] failed to get content.`);
        console.error(filter);
        console.error(filterInfo);
        console.error(err);
        return;
      }

      for (var i = 0; i < results.length; i++) {
        moment.locale('en-us');
        results[i].parsedDate = moment(results[i].created_time).toDate();
      }

      results.sort((a,b) => {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      });

      for (var i = 0; i < results.length; i++) {
        this._onContent(filter, results[i]);
      }
      this._filterInfos[filter.parameters.url].lastFetch = now;
    })
  }

  _onContent(filter, content) {
    console.log('[FacebookRetriever] Content parse');
    console.log(JSON.stringify(content, '', 4));
    
    // Is this content of a type we want?
    if (supportedTypes.indexOf(content.type) === -1) {
      return;
    }

    var newContent = new Content();

    if (content.message)
      newContent.text = content.message;
    else
      newContent.text = '';

    newContent.author.photo = '';//content.user.profile_image_url;
    if (content.from.picture
        && content.from.picture.data.is_silhouette === false) {
      newContent.author.photo = content.from.picture.data.url;
    }
    newContent.author.name = content.from.name;//content.user.name;
    newContent.author.url = 'https://facebook.com/' + content.from.id;//http://twitter.com/' + content.user.screen_name;

    newContent.source.type = 'facebook',
    newContent.source.url = content.permalink_url;
    newContent.source.id = content.id;

    var amountVideos = 0;
    var videosToFetch = [];

    if (content.type === 'video') {
      newContent.media = [{
        type: 'video',
        url: content.source
      }];
      eachSubAttachment(content, (subAttachment) => {
        if (subAttachment.type === 'photo') {
          newContent.media.push({
            type: 'image',
            url: subAttachment.media.image.src
          });
        }
      })
    } else if (content.type === 'photo') {
      newContent.media = [];
      eachSubAttachment(content, (subAttachment) => {
        if (subAttachment.type === 'photo') {
          newContent.media.push({
            type: 'image',
            url: subAttachment.media.image.src
          });
        } else if (subAttachment.type === 'video') {
          amountVideos++;
          videosToFetch.push(subAttachment.target.id);
        }
      })
      eachAttachment(content, (attachment) => {
        if (attachment.media) {
          newContent.media.push({
            type: 'image',
            url: attachment.media.image.src
          });
        }
      });
    } else if (content.type === 'status') {
      if (content.attachments && content.attachments.data) {
        newContent.media = [];
        eachSubAttachment(content, (subAttachment) => {
          if (subAttachment.type === 'video') {
            amountVideos++;
            videosToFetch.push(subAttachment.target.id);
          } else if (subAttachment.type === 'photo') {
            if (subAttachment.media && subAttachment.media.image) {
              newContent.media.push({
                type: 'image',
                url: subAttachment.media.image.src
              });
            }
          }
        })
      }
    } else {
      eachAttachment(content, (attachment) => {
        if (attachment.media && attachment.media.image) {
          if (!newContent.media) {
            newContent.media = [];
          }
          newContent.media.push({
            type: 'image',
            url: attachment.media.image.src
          });
        }
      })
    }

    moment.locale('en-us');
    newContent.date = moment(content.created_time).toDate();

    newContent.fetchDate = new Date();

    var contentWrapper = {
      filter: filter,
      content: newContent
    };
    if (amountVideos === 0) {
      this._notifyListeners("new", [contentWrapper]);
    } else {
      for (let i in videosToFetch) {
        graph.get(videosToFetch[i], {
          fields: 'source'
        }, (error, response) => {
          amountVideos--;
          if (error) {
            console.error(`[FacebookRetriever] error getting video info ${videosToFetch[i]}`);
          } else if (response.source) {
            newContent.media.push({
              type: 'video',
              url: response.source
            });
          }
          if (amountVideos === 0) {
            this._notifyListeners("new", [contentWrapper]);
          }
        });
      }
    }
  }

  _getContentForFilter(filter) {
    // console.log('_getContentForFilter');
    // console.log(filter);
    if (typeof this._filterInfos[filter.parameters.url] === 'undefined') {
      console.log('undefined?');
      console.log(this._filterInfos);
      return;
    }
    var filterInfo = this._filterInfos[filter.parameters.url];

    var now = new Date();

    this._getPaginatedResults(filterInfo.id + '/feed', {
      fields: fetchFields,
      since: Math.floor(filterInfo.lastFetch.getTime() / 1000)
    }, (err, results) => {
      if (err) {
        console.error(`[FacebookRetriever] failed to get content.`);
        console.error(filter);
        console.error(filterInfo);
        console.error(err);
        return;
      }

      for (var i = 0; i < results.length; i++) {
        moment.locale('en-us');
        results[i].parsedDate = moment(results[i].created_time).toDate();
      }

      results.sort((a,b) => {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      });

      for (var i = 0; i < results.length; i++) {
        this._onContent(filter, results[i]);
      }
      this._filterInfos[filter.parameters.url].lastFetch = now;
    })
  }

  _getNewContent() {
    // console.log('_getNewContent');
    for (let i = 0; i < this._filters.length; i++) {
      let filter = this._filters[i].filter;
      // console.log(filter);
      if (typeof this._filterInfos[filter.parameters.url] === 'undefined') {
        this._getFilterInfos(filter, (error) => {
          if (!error) {
            this._getContentForFilter(filter);
          }
        });
        continue;
      }
      if (this._filterInfos[filter.parameters.url] !== false) {
        // console.log('an id');
        this._getContentForFilter(filter);
      }
    }
  }

  _getPaginatedResults(url, params, callback) {
    // console.log(url + ' ' + JSON.stringify(params));
    function onData(error, result) {
      if (error){
        callback(error, null);
        return;
      }
      if (result.data.length === 0) {
        callback(null, results);
        return;
      }
      for (var i = 0; i < result.data.length; i++) {
        results.push(result.data[i]);
      }
      graph.get(result.paging.next, {}, onData);
    }

    var results = [];

    graph.get(url, params, onData);
  }

  _getFilterInfos(filter, callback) {
    graph.get('', {
      id: filter.parameters.url
    }, (error, response) => {
      if (error) {
        this._filterInfos[filter.parameters.url] = false;
        console.error(`[FacebookRetriever] Error retrieving ID for URL ${filter.parameters.url}`);
        callback(`[FacebookRetriever] Error retrieving ID for URL ${filter.parameters.url}`);
        return;
      }
      var id = null;
      if (typeof response.name === 'undefined') {
        var res = filter.parameters.url.match(eventUrlRegexp);
        if (res !== null) {
          id = res[3];
        }
      } else {
        id = response.id;
      }
      if (id === null) {
        console.error(`[FacebookRetriever] Could not guess ID from ${filter.parameters.url}`);
        this._filterInfos[filter.parameters.url] = false;
        callback(`[FacebookRetriever] Could not guess ID from ${filter.parameters.url}`);
        return;
      }
      this._filterInfos[filter.parameters.url] = {
        id: id,
        lastFetch: new Date()
      };
      callback();
    })
  }

  static filterToText(filter) {
    return filter.url;
  }

  static textToFilter(text) {
    return {url: text};
  }
}

function eachAttachment(content, callback) {
  if (content.attachments && content.attachments.data) {
    for (var i = 0; i < content.attachments.data.length; i++) {
      var attachment = content.attachments.data[i];
      callback(attachment);
    }
  }
}

function eachSubAttachment(content, callback) {
  eachAttachment(content, (attachment) => {
    if (attachment.subattachments && attachment.subattachments.data) {
      for (var j = 0; j < attachment.subattachments.data.length; j++) {
        var subAttachment = attachment.subattachments.data[j];
        callback(subAttachment);
      }
    }
  });
}

module.exports = exports = FacebookRetriever;