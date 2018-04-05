'use strict';

let mongoose = require('mongoose');
let User = mongoose.model('User');

let config = require(__dirname + '/../../config');

var eventSchema = mongoose.Schema({
  // The user on which this event is linked
  // user: {type: mongoose.Schema.ObjectId, ref: 'User'},
  // Display name of this event
  name: String,
  // The description displayed on walls
  description: String,
  // Date at which to start considering content
  dateStart: Date,
  // Date at which to stop considering content
  dateEnd: Date,
  // A list of content sources
  sources: [mongoose.Schema.Types.Mixed],
  // Parameters used in the rendering of screens
  displayParameters: mongoose.Schema.Types.Mixed,
  // Whether new content needs to be moderated or not
  moderateNewContent: {type: Boolean, default: true},
  url: String,
  location: String,
  deleted: {type: Boolean, default: false}
});

eventSchema.methods.getWallUrl = function () {
  return `http://${config.host}:${config.port}/wall/wall.html?host=${config.host}&port=${config.port}&event=${this._id}`;
}

eventSchema.methods.getIFrameUrl = function () {
  return `http://${config.host}:${config.port}/wall/wall.html?host=${config.host}&port=${config.port}&event=${this._id}&iframe=1`;
}

eventSchema.methods.getWebappUrl = function () {
  return `http://${config.host}:${config.port}/webapp/?event=${this._id}`;
}

module.exports = exports = mongoose.model('Event', eventSchema);