'use strict';

let Notifier = require('./notifier');

class ContentRetriever extends Notifier {
  constructor() {
    super();
  }

  initialize(callback) {
    throw "initialize function must be defined for ContentRetriever";
  }

  removeSourceFilter(filter) {
    throw "removeSourceFilter function must be defined for ContentRetriever";
  }

  addSourceFilter(listener, filter, options) {
    throw "addSourceFilter function must be defined for ContentRetriever";
  }

  getContents(filter, options) {
    throw "getContent function must be defined for ContentRetriever";
  }

  filterToText(filter) {
    throw "filterToText function must be defined for ContentRetriever";
  }

  textToFilter(text) {
    throw "textToFilter function must be defined for ContentRetriever";
  }
}

module.exports = exports = ContentRetriever;