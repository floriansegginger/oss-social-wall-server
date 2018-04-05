let Twitter = require('twitter');
let moment = require('moment');
let bigInt = require('big-integer');

let config = require(__dirname + '/../config.js');
let ContentRetriever = require(__dirname + '/../models/contentRetriever');
let Content = require(__dirname + '/../models/data/content');

const minUpdateTime = 20 * 1000;
const fetchAmount = 20;

class TwitterRetriever extends ContentRetriever {
  constructor() {
    super();
    this.type = "twitter";
    this._filters = [];
    this._needsUpdating = false;
    this._oldHashtags = '';
  }

  initialize(callback) {
    this._client = new Twitter({
      consumer_key: config.twitter.consumer_key,
      consumer_secret: config.twitter.consumer_secret,
      access_token_key: config.twitter.access_token_key,
      access_token_secret: config.twitter.access_token_secret
    });
    process.nextTick(callback);
    this._lastUpdate = new Date(0);
    this._updateInterval = setInterval(this._tryUpdateSourceFilters.bind(this), minUpdateTime);
  }

  onContent(filter, content) {
    console.log('[TwitterRetriever] Content parse');
    console.log(JSON.stringify(content, '', 4));
    var newContent = new Content();

    if (typeof content.extended_tweet !== 'undefined') {
      newContent.text = content.extended_tweet.full_text;
    } else if (typeof content.full_text !== 'undefined') {
      newContent.text = content.full_text;
    } else {
      newContent.text = content.text;
    }

    newContent.author.photo = content.user.profile_image_url;
    newContent.author.name = content.user.name;
    newContent.author.url = 'http://twitter.com/' + content.user.screen_name;

    newContent.source.type = 'twitter',
    newContent.source.url = newContent.author.url + '/status/' + content.id_str;
    newContent.source.id = content.id_str;

    // Get photos
    var contentEntities = content.extended_entities;
    if (typeof content.extended_tweet !== 'undefined') {
      contentEntities = content.extended_tweet.entities;
    }

    if (typeof contentEntities  !== 'undefined' 
      && typeof contentEntities.media !== 'undefined') {
      var allMedia = [];
      for (var i = 0; i < contentEntities.media.length; i++) {
        var media = contentEntities.media[i];
        if (media.type === 'photo') {
          allMedia.push({
            type: 'image',
            url: media.media_url
          });
        } else if (media.type == 'animated_gif') {
          // GIF is a special case, find the one with the bitrate of 0 (wtf twitter??)
          var highestBitrate = 0;
          var highestBitrateIndex = -1;
          for (var j = 0; j < media.video_info.variants.length; j++) {
            var variant = media.video_info.variants[j];
            if (variant.bitrate == 0) {
              highestBitrate = variant.bitrate;
              highestBitrateIndex = j;
            }
          }
          allMedia.push({
            type: 'video',
            url: media.video_info.variants[highestBitrateIndex].url
          });
        } else if (media.type === 'video') {
          // Video is a special case, find the one with the highest bitrate
          var highestBitrate = 0;
          var highestBitrateIndex = -1;
          for (var j = 0; j < media.video_info.variants.length; j++) {
            var variant = media.video_info.variants[j];
            if (!variant.bitrate)
              continue;
            if (variant.bitrate > highestBitrate) {
              highestBitrate = variant.bitrate;
              highestBitrateIndex = j;
            }
          }
          allMedia.push({
            type: 'video',
            url: media.video_info.variants[highestBitrateIndex].url
          });
        }
      }
      if (allMedia.length != 0) {
        newContent.media = allMedia.slice();
      }
    }

    moment.locale('en-us');
    newContent.date = moment(content.created_at, 'ddd MMM DD HH:mm:ss ZZ YYYY').toDate();

    newContent.fetchDate = new Date();

    var contentWrapper = {
      filter: filter,
      content: newContent
    };
    this._notifyListeners("new", [contentWrapper]);
  }

  removeSourceFilter(listener, filter) {
    for (var i in this._filters) {
      if (
        this._filters[i].listener === listener 
        && this._filters[i].filter.parameters.hashtag == filter.parameters.hashtag) {
        this._filters.splice(i, 1);
        break;
      }
    }
    process.nextTick(this._tryUpdateSourceFilters.bind(this));
  }

  addSourceFilter(listener, filter, options) {
    var dateStart = options.dateStart;
    var dateEnd = options.dateEnd;
    // Do not add duplicate hashtags
    for (var i in this._filters) {
      if (this._filters[i].filter.parameters.hashtag == filter.parameters.hashtag
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
    process.nextTick(this._tryUpdateSourceFilters.bind(this));
  }

  _tryUpdateSourceFilters() {
    if (new Date().getTime() - this._lastUpdate.getTime() >= minUpdateTime) {
      this.updateSourceFilters();
    }
  }

  updateSourceFilters() {
    var hashtags = '';
    var addedHashtags = {};
    for (var i = 0; i < this._filters.length; i++) {
      var filter = this._filters[i].filter;
      if (typeof addedHashtags[filter.parameters.hashtag] !== 'undefined') {
        continue;
      }
      if (i !== 0) {
        hashtags += ',';
      }
      hashtags += filter.parameters.hashtag;
      addedHashtags[filter.parameters.hashtag] = true;
    }

    if (this._oldHashtags === hashtags || hashtags.length === 0)
      return;
    this._oldHashtags = hashtags;
    this._lastUpdate = new Date();

    console.log("NOW LISTENING TO HASHTAGS");
    console.log(hashtags);
    
    if (this._stream) {
      this._stream.destroy();
    }

    this._stream = this._client.stream('statuses/filter', {track: hashtags, tweet_mode: 'extended'});

    this._stream.on('data', (data) => {
      var tweetData = data;
      if (typeof data.extended_tweet !== 'undefined') {
        tweetData = data.extended_tweet;
      }
      if (typeof tweetData.entities.hashtags !== 'undefined') {
        for (var i = 0; i < tweetData.entities.hashtags.length; i++) {
          for (var j = 0; j < this._filters.length; j++) {
            var filterObj = this._filters[j];
            var dateTime = new Date(parseInt(data.timestamp_ms));
            if ('#' + tweetData.entities.hashtags[i].text.toLowerCase() == filterObj.filter.parameters.hashtag.toLowerCase()
                && dateTime > filterObj.dateStart
                && dateTime < filterObj.dateEnd ) {
              this.onContent(this._filters[j].filter, data);
              return;
            }
          }
        }
        // console.error("Could not find matching filter");
      }
    });

    this._stream.on('error', function onTwitterError(error) {
      console.error('Twitter error');
      console.error(error);
    });
  }

  getContents(filter, options) {
    var dateStart = options.dateStart;
    var dateEnd = options.dateEnd;
    function onTweets(error, tweets, response) {
      if (error) {
        console.error(error);
        return;
      }
      console.log(JSON.stringify(tweets, null, 2));
      if (tweets.statuses.length === 0) {
        return;
      }
      var minId = Infinity;
      for (var i in tweets.statuses) {
        var tweet = tweets.statuses[i];
        moment.locale('en-us');
        var dateTime = moment(tweet.created_at, 'ddd MMM DD HH:mm:ss ZZ YYYY').toDate();
        // console.log(JSON.stringify(tweet, null, 4));
        if (dateTime >= dateStart && dateTime <= dateEnd) {
          this.onContent(filter, tweet);
        }
        minId = tweet.id_str;
      }      
      this._client.get('search/tweets', {
        q: filter.parameters.hashtag,
        until: moment(dateEnd).format('YYYY-MM-DD'),
        // tweet_mode: 'extended',
        count: fetchAmount,
        max_id: bigInt(minId).minus(1).toString()
      }, onTweets.bind(this));
    }
    // console.log(`Somebody asked for ${JSON.stringify(filter)} between ${dateStart} and ${dateEnd}?`);
    // console.log(`Until ${moment(dateEnd).format('YYYY-MM-DD')}`);
    moment.locale('en-us');
    this._client.get('search/tweets', {
      q: filter.parameters.hashtag,
      tweet_mode: 'extended',
      until: moment(dateEnd).format('YYYY-MM-DD'),
      count: fetchAmount
    }, onTweets.bind(this));
  }

  static filterToText(filter) {
    return filter.hashtag;
  }

  static textToFilter(text) {
    return {hashtag: text};
  }
}

module.exports = exports = TwitterRetriever;