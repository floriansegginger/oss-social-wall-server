'use strict';

let mongoose = require('mongoose');

let Event = require('./data/event');
let EventContent = mongoose.model('EventContent');

let Notifier = require('./notifier')
let contentFactory = require('./contentFactory');

let loadedEvents = [];

class EventManager extends Notifier{
  constructor(id, event) {
    super();
    this.event = null;

    if (event) {
      this.event = event;
      this._id = event._id;

      contentFactory.addContentListener(this, {
        type: 'webapp',
        parameters: {
          event: this._id
        }
      }, {
        dateStart: this.event.dateStart, 
        dateEnd: this.event.dateEnd,
        eventId: this._id
      });
      for (var i = 0; i < this.event.sources.length; i++) {
        console.log('add content listener');
        contentFactory.addContentListener(this, this.event.sources[i], {
          dateStart: this.event.dateStart, 
          dateEnd: this.event.dateEnd,
          eventId: this._id
        });
      }
    } else {
      this._id = id;
    }
  }

  /**
   * Gets the actual event associated with this EventManager. Note: will also
   * register to the content factory
   * @param  {Function(error)} callback Called upon completion
   */
  populate(callback) {
    if (this.event === null) {
      Event
        .findOne({_id: this._id})
        .exec((error, event) => {
          console.log('populate');
          if (!error) {
            this.event = event;
            contentFactory.addContentListener(this, {
              type: 'webapp',
              parameters: {
                event: this._id
              }
            }, {
              dateStart: this.event.dateStart, 
              dateEnd: this.event.dateEnd,
              eventId: this._id
            });
            for (var i = 0; i < this.event.sources.length; i++) {
              contentFactory.addContentListener(this, this.event.sources[i], {
                dateStart: this.event.dateStart, 
                dateEnd: this.event.dateEnd,
                eventId: this._id
              });
            }
          }
          callback(error);
        });
    }
  }

  /**
   * Returns a list of all the EventContents matching this event.
   * @param  params                 Filter your query
   * @param {Boolean} params.valid  If true, return only moderated content, if 
   *                                false only unmoderated content
   * @param {Date} params.dateStart A date before which no content will be returned
   * @param {Date} params.dateEnd   A date after which no content will be returned
   * @param {Number} params.count   Maximum amount of content to return
   * @param {Number} params.start   An offset
   * @param {String} params.sort    'asc' or 'desc'
   * @param {eventContentsCallback} callback  The callback function to call when 
   *                                          content is obtained
   */
  getEventContents({
    valid = undefined,
    dateStart = null,
    dateEnd = null,
    count = 0,
    start = 0,
    sort = 'asc'
  } = {}, callback) {
    let queryObj = {
      event: this._id,
    };
    if (typeof valid !== 'undefined') {
      queryObj.valid = valid;
    }

    EventContent
      .find(queryObj)
      .populate('content')
      .exec((error, eventContents) => {
        if (error) {
          callback(error);
          return;
        }
        var filtered = [];
        for (var i = 0; i < eventContents.length; i++) {
          var ec = eventContents[i];
          if (ec.content.date.getTime() >= this.event.dateStart.getTime()
              && ec.content.date.getTime() <= this.event.dateEnd.getTime() ) {
            var ok = true;
            if (dateStart !== null 
                && ec.content.date.getTime() < dateStart.getTime()) {
              ok = false;
            }
            if (dateEnd !== null
                && ec.content.date.getTime() > dateEnd.getTime()) {
              ok = false;
            }
            if (ok) {
              filtered.push(ec);
            }
          }
        }
        eventContents = filtered.sort((ec1, ec2) => {
          var cmp = ec1.content.date > ec2.content.date;
          if (ec1.pinned)
            cmp = true;
          if (ec2.pinned)
            cmp = false;
          if (cmp && sort === 'asc' || !cmp && sort === 'desc')
            return 1;
          else
            return -1;
        });
        if (count !== 0 && start !== 0) {
          eventContents = eventContents.slice(start, start + count);
        } else if (count !== 0) {
          eventContents = eventContents.slice(0, count);
        } else if (start !== 0) {
          eventContents = eventContents.slice(start);
        }
        callback(null, eventContents);
      });
  }

  /**
   * Moderate a givent eventContent
   * @param  {object|string}   eventContent The eventContent or just an ID
   * @param  {boolean}   valid        Whether the moderation is Accept or Deny
   * @param  {Function(error)} callback     Will be called on complete
   */
  moderate(eventContent, valid, callback = null) {
    var idToFind;
    if (typeof eventContent === "string") {
      idToFind = eventContent;
    } else {
      idToFind = eventContent._id;
    }

    EventContent.findOne({_id:idToFind})
      .populate('content')
      .exec((error, eventContent) => {
        if (error) {
          callback(error);
          return;
        }

        eventContent.valid = valid;
        eventContent.moderatedDate = new Date();
        eventContent.save((error, eventContent) => {
          if (error) {
            callback(error);
            return;
          }
          if (eventContent.valid) {
            this._notifyListeners('new', [eventContent]);
          }
          else
            this._notifyListeners('deleted', [eventContent]);
          callback();
        });
      });
  }

  pin(eventContent, pinned, callback = null) {
    var idToFind;
    if (typeof eventContent === "string") {
      idToFind = eventContent;
    } else {
      idToFind = eventContent._id;
    }

    EventContent.findOne({_id:idToFind})
      .populate('content')
      .exec((error, eventContent) => {
        if (error) {
          callback(error);
          return;
        }

        if (eventContent.pinned !== pinned) {
          eventContent.pinned = pinned;
          eventContent.save((error, eventContent) => {
            if (error) {
              callback(error);
              return;
            }
            if (eventContent.valid) {
              this._notifyListeners('modified', [eventContent]);
            }
            callback();
          });
        }
      });
  }

  select(eventContent, selected, callback = null) {
    var idToFind;
    if (typeof eventContent === "string") {
      idToFind = eventContent;
    } else {
      idToFind = eventContent._id;
    }

    EventContent.findOne({_id:idToFind})
      .populate('content')
      .exec((error, eventContent) => {
        if (error) {
          callback(error);
          return;
        }

        if (eventContent.selected !== selected) {
          eventContent.selected = selected;
          eventContent.save((error, eventContent) => {
            if (error) {
              callback(error);
              return;
            }
            if (eventContent.valid) {
              this._notifyListeners('modified', [eventContent]);
            }
            callback();
          });
        }
      });
  }

  onNotify(type, contentData) {
    // console.log("[EventManager] Got " + type + " content");
    // console.log(JSON.stringify(contentData));
    var eventContents = [];
    // Create a EventContent for these contents
    for (var i = 0; i < contentData.length; i++) {
      var newEventContent = new EventContent();
      newEventContent.content = contentData[i].content;
      newEventContent.event = this.event;
      if (this.event.moderateNewContent) {
        newEventContent.save();
      } else {
        newEventContent.valid = true;
        newEventContent.moderatedDate = new Date();
        newEventContent.save((error, savedEventContent) => {
          this._notifyListeners('new', [savedEventContent]);
        });
      }
      eventContents.push(newEventContent);
    }
    // TODO: remove this once moderation works
    // this._notifyListeners(type, eventContents);
  }

  /**
   * This function is to be called when an even has changed in the database.
   * It will re-subscribe to the contentFactory and do other funky stuff.
   */
  onEventUpdated(callback) {
    contentFactory.removeContentListener(this);
    this.event = null;
    this.populate((error) => {
      this._notifyListeners('modifiedEvent', this.event);
      if (callback)
        callback();
    });
  }

  updateContents() {
    for (var i = 0; i < this.event.sources.length; i++) {
      var source = this.event.sources[i];
      contentFactory.getContents(source.type, source, {
        dateStart: this.event.dateStart, 
        dateEnd: this.event.dateEnd,
        eventId: this.event._id.toString()
      });
    }
  }

  static loadAll(callback) {
    Event
      .find({deleted: false})
      .exec((error, events) => {
        if (error) {
          callback(error);
          return;
        }
        for (var i in events) {
          var manager = new EventManager(null, events[i]);
          loadedEvents.push(manager);
        }
        callback();
      });
  }

  static createForId(id, callback) {
    for (var i in loadedEvents) {
      if (loadedEvents[i]._id.toString() === id.toString()) {
        callback('EventManager already exists');
        return;
      }
    }
    Event
      .findOne({_id: id})
      .exec((error, event) => {
        if (error) {
          callback(error);
          return;
        }
        var manager = new EventManager(null, event);
        loadedEvents.push(manager);
        callback();
      });
  }

  static destroyForId(id) {
    for (var i in loadedEvents) {
      var event = loadedEvents[i];
      if (event._id.toString() === id.toString()) {
        loadedEvents.splice(i, 1);
        return true;
      }
    }
  }

  static getForId(id) {
    for (var i in loadedEvents) {
      var event = loadedEvents[i];
      if (event._id.toString() === id.toString()) {
        return loadedEvents[i];
      }
    }
    return null;
  }

  static getLatestForUser(user) {
    var eventForUser = [];
    // TODO
    return loadedEvents[0];
  }
}

/**
 * Callback for when events are fetched
 * @callback eventContentsCallback
 * @param {Error}  error            a possible error
 * @param {array}   eventContents   A list of EventContents (if no error)
 */

module.exports = exports = EventManager;