let moment = require('moment');
let ig = require('instagram-node').instagram();
let mongoose = require('mongoose');

let config = require(__dirname + '/../config.js');
let ContentRetriever = require(__dirname + '/../models/contentRetriever');
let Content = require(__dirname + '/../models/data/content');

const refreshInterval = 30 * 1000;
const fetchAmount = 100;
const resetInterval = 99 * 1000;

class InstagramRetriever extends ContentRetriever {
  constructor() {
    super();
    this.type = "instagram";
    this._filterInfos = [];
    this._eventInfos = {};
  }

  initialize(callback) {
    process.nextTick(callback);
    this._lastUpdate = new Date(0);
    this._updateInterval = setInterval(this._getNewContent.bind(this), refreshInterval);
    this._resetInterval = setInterval(this._resetEventInfos.bind(this), resetInterval);
  }

  removeSourceFilter(listener, filter) {
    for (var i in this._filterInfos) {
      if ( this._filterInfos[i].listener === listener 
            && this._filterInfos[i].filter.parameters.hashtag == filter.parameters.hashtag) {
        let foundFilter = this._filterInfos[i];
        this._filterInfos.splice(i, 1);
        if (typeof this._eventInfos[foundFilter.eventId] !== 'undefined') {
          delete this._eventInfos[foundFilter.eventId];
        }
        break;
      }
    }
  }

  addSourceFilter(listener, filter, options) {
    var dateStart = options.dateStart;
    var dateEnd = options.dateEnd;
    var eventId = options.eventId;
    // Do not add duplicate hashtags
    for (var i in this._filterInfos) {
      if (this._filterInfos[i].filter.parameters.hashtag == filter.parameters.hashtag
        && this._filterInfos[i].listener === listener) {
        return;
      }
    }
    this._filterInfos.push({
      listener: listener, 
      filter: filter, 
      dateStart: dateStart,
      dateEnd: dateEnd,
      eventId: eventId
    });
  }

  getContents(filter, options) {
    var eventId = options.eventId;
    var eventInfo = this._eventInfos[eventId];
    if (typeof eventInfo === 'undefined') {
      this._getEventInfos(eventId, (error) => {
        if (!error) {
          this.getContents(filter, options);
        }
      });
      return;
    }

    // Instagram has no way to filter by date!
    return this._getContentForFilter(filter, eventId);
  }

  _onContent(filter, content) {
    console.log('[InstagramRetriever] Content parse');
    console.log(JSON.stringify(content, '', 4));
    
    var newContent = new Content();

    if (content.caption && content.caption.text)
      newContent.text = content.caption.text;
    else
      newContent.text = '';

    newContent.author.photo = '';
    if (content.user.profile_picture) {
      newContent.author.photo = content.user.profile_picture;
    }
    newContent.author.name = content.user.full_name;
    newContent.author.url = 'https://instagram.com/' + content.user.username;

    newContent.source.type = 'instagram',
    newContent.source.url = content.link;
    newContent.source.id = content.id;

    // TODO
    if (content.type === 'image') {
      newContent.media = [{
        type: 'image',
        url: content.images.standard_resolution.url
      }];
    } else if (content.type === 'video') {
      newContent.media = [{
        type: 'video',
        url: content.videos.standard_resolution.url
      }];
    }

    moment.locale('en-us');
    newContent.date = moment(content.created_time, 'X').toDate();

    newContent.fetchDate = new Date();

    var contentWrapper = {
      filter: filter,
      content: newContent
    };
    
    this._notifyListeners("new", [contentWrapper]);
  }

  _getNewContent() {
    for (let i = 0; i < this._filterInfos.length; i++) {
      let filterInfo = this._filterInfos[i];
      // console.log(filter);
      if (typeof this._eventInfos[filterInfo.eventId] === 'undefined') {
        this._getEventInfos(filterInfo.eventId, (error) => {
          if (!error) {
            this._getContentForFilter(filterInfo.filter, filterInfo.eventId);
          } else {
            console.error(error);
          }
        });
        continue;
      }
      if (this._eventInfos[filterInfo.eventId] !== false) {
        // console.log('an id');
        this._getContentForFilter(filterInfo.filter, filterInfo.eventId);
      }
    }
  }

  _getContentForFilter(filter, eventId) {
    // console.log('_getContentForFilter');
    // console.log(filter);
    var eventInfo = this._eventInfos[eventId];
    if (typeof eventInfo === 'undefined') {
      return;
    }

    var now = new Date();

    this._getPaginatedResults(filter.parameters.hashtag, eventInfo.token, (err, results, remaining, limit) => {
      if (err) {
        console.error(`[InstagrameRetriever] failed to get content.`);
        console.error(filter);
        console.error(eventInfo);
        // console.error(err);
        return;
      }

      for (var i = 0; i < results.length; i++) {
        moment.locale('en-us');
        results[i].parsedDate = moment(results[i].created_time, 'X').toDate();
      }

      results.sort((a,b) => {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      });

      for (var i = 0; i < results.length; i++) {
        this._onContent(filter, results[i]);
      }
      eventInfo.lastFetch = now;
    })
  }

  _getPaginatedResults(hashtag, token, callback) {
    hashtag = hashtag.replace('#','');
    var results = [];
    function onData(error, medias, pagination, remaining, limit) {

      if (error) {
        callback(error, results);
        return;
      }

      for (let i = 0; i < medias.length; i++) {
        results.push(medias[i]);
      }

      if (medias.length != 0 && pagination.next_max_tag_id) {
        ig.tag_media_recent(hashtag, {
          count: fetchAmount,
          max_tag_id: pagination.next_max_tag_id
        }, onData);
      } else {
        callback(null, results, remaining, limit);
      }
    }

    var results = [];

    ig.use({access_token: token});
    ig.tag_media_recent(hashtag, {count: fetchAmount}, onData);
  }

  _getEventInfos(eventId, callback) {
    console.log('try get token ' + eventId);
    InstagramEventToken
      .findOne({event: eventId})
      .exec((error, eventToken) => {
        if (error) {
          this._eventInfos[eventId] = false;
          callback(error);
          return;
        }
        if (!eventToken) {
          callback(`No token found for event ${eventId}`);
          return;
        }
        this._eventInfos[eventId] = {
          token: eventToken.token,
          lastFetch: new Date()
        };
        callback();
      });
  }

  _resetEventInfos() {
    this._eventInfos = {};
  }

  static filterToText(filter) {
    return filter.hashtag;
  }

  static textToFilter(text) {
    return {hashtag: text};
  }
}

var InstagramEventTokenSchema = mongoose.Schema({
  event: {type: mongoose.Schema.ObjectId, ref:'Event'},
  token: String,
  username: String
})

var InstagramEventToken = mongoose.model('InstagramEventToken', InstagramEventTokenSchema);

InstagramRetriever.InstagramEventToken = InstagramEventToken;

module.exports = exports = InstagramRetriever;