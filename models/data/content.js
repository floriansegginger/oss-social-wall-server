'use strict';

let mongoose = require('mongoose');

var contentSchema = mongoose.Schema({
  // String representation of this content
  text: String,
  // A list of media (photos / videos) for this content
  media: [{
    type: {type: String, enum: ['video', 'image']},
    url: String
  }],
  // The date this content was created (according to the source)
  date: Date,
  // Who created this media (according to the source)
  author: {
    name: String,
    url: String,
    photo: String
  },
  // Where this media comes from
  source: {
    type: {type: String, enum: ['twitter', 'facebook', 'instagram', 'webapp']},
    url: String,
    id: String
  },
  fetchDate: {type: Date, default: Date.now},
  modifiedDate: Date
});

module.exports = exports = mongoose.model('Content', contentSchema);