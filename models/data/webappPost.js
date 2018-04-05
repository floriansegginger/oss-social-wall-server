'use strict';

let mongoose = require('mongoose');
let Event = mongoose.model('Event');

let listeners = [];

var webappPostSchema = mongoose.Schema({
  event: {type: mongoose.Schema.ObjectId, ref: 'Event'},
  // String representation of this content
  text: {type: String, required: true},
  // A username chosen by the user
  username: String,
  // The (optional) company
  company: String,
  // Insertion date
  date: {type: Date, default: Date.now},
  // A photo
  media: {
    type: {type: String, enum: ['image', 'video']},
    url: String
  }
});

webappPostSchema.post('save', function (post) {
  for (var i in listeners) {
    listeners[i].onNotify.call(listeners[i], 'save', post);
  }
});

webappPostSchema.statics.addListener = function addListener(listener) {
  listeners.push(listener);
}

webappPostSchema.statics.removeListener = function removeListener(listener) {
  for (var i in listeners) {
    if (listeners[i] === listener) {
      listeners.splice(i, 1);
      return;
    }
  }
}

module.exports = exports = mongoose.model('WebappPost', webappPostSchema);