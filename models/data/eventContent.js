'use strict';

let mongoose = require('mongoose');
let Event = mongoose.model('Event');
let Content = mongoose.model('Content');

var eventContentSchema = mongoose.Schema({
  event: {type: mongoose.Schema.ObjectId, ref: 'Event'},
  content: {type: mongoose.Schema.ObjectId, ref: 'Content'},
  pinned: {type: Boolean, default: false},
  selected: {type: Boolean, default: false},
  moderatedDate: Date,
  valid: {type: Boolean, default: false}
});

module.exports = exports = mongoose.model('EventContent', eventContentSchema);