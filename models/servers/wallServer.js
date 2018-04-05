'use strict';

let ws = require('ws');
let EventManager = require('../eventManager');
let config = require('../../config');

const urlRegexp = /^https?\:\/\//;

class WallServer {
  constructor(httpServer) {
    this._handlers = [];

    var wss = new ws.Server({
      server: httpServer
    });

    wss.on('connection', (ws) => {
      console.log(`New websocket connection from ${ws.upgradeReq.connection.remoteAddress}`);
      ws.on('message', this.onMessage.bind(this, ws));
    });
  }

  onMessage(ws, message) {
    try {
      var jsonMessage = JSON.parse(message);
    } catch(e) {
      console.error(`Impossible to parse receieved message ${message}`);
      return;
    }
    if (jsonMessage.type === 'hello') {
      console.log("Got a hello message");
      if (jsonMessage.wallId) {
        var handler = this.getHandlerById(jsonMessage.wallId);
        if (handler !== null) {
          console.log("handler found - reviving old connection");
          handler.revive(ws);
        } else {
          console.log("handler not found - new connection");
          this.createHandler(ws, message);
        }
      } else {
        console.log("no handler specified - new handler created")
        this.createHandler(ws, message);
      }
    }
  }

  createHandler(ws, message) {
    ws.removeListener('message', this.onMessage);
    var handler = new WallHandler(this, ws);
    handler.onMessage(message);
    this._handlers.push(handler);
    console.log(`[WallServer] There are now ${this._handlers.length} handlers.`);
  }

  removeHandler(handler) {
    for (var i = 0; i < this._handlers.length; i++) {
      if (this._handlers[i] === handler) {
        this._handlers.splice(i, 1);
        return;
      }
    }
  }

  getHandlerById(id) {
    for (var i in this._handlers) {
      if (this._handlers[i].id === id)
        return this._handlers[i];
    }
    return null;
  }

  static eventContentToWallContent(eventContent) {
    var cont = {};
    cont.id = eventContent._id;
    cont.text = eventContent.content.text;
    cont.media = eventContent.content.media;
    cont.date = eventContent.content.date;
    cont.author = eventContent.content.author;
    cont.source = eventContent.content.source;
    cont.modifiedDate = eventContent.content.modifiedDate;
    cont.fetchDate = eventContent.content.fetchDate;

    cont.pinned = eventContent.pinned;
    cont.selected = eventContent.selected;
    cont.valid = eventContent.valid;
    cont.moderatedDate = eventContent.moderatedDate;

    if (cont.media) {
      for (var i = 0; i < cont.media.length; i++){
        if (!cont.media[i].url.match(urlRegexp)) {
          cont.media[i].url = `http://${config.host}:${config.port}${cont.media[i].url}`;
        }
      }
    }

    return cont;
  }

  static eventToWallEvent(event) {
    var eventFiltered = event.toObject();

    delete eventFiltered.user;
    delete eventFiltered.__v;

    eventFiltered.displayParameters.backgroundImage = `http://${config.host}:${config.port}${eventFiltered.displayParameters.backgroundImage}`;
    eventFiltered.displayParameters.logo = `http://${config.host}:${config.port}${eventFiltered.displayParameters.logo}`;

    return eventFiltered;
  }  
}

const MAX_ID = 1000000000;
let lastId = Math.floor(Math.random() * MAX_ID);

class WallHandler {
  constructor(server, ws) {
    this._server = server;
    this._ws = ws;
    this._eventManager = null;
    this.id = 0;

    this._lastActivity = null;
    this._pingInterval = setInterval(this.ping.bind(this), config.pingInterval * 1000);

    this._ws.on('message', this.onMessage.bind(this));
    this._ws.on('close', this.onClose.bind(this));
  }

  ping() {
    this.sendMessage('ping', {});
  }

  onTimeout() {
    console.log(`Connection to wall ${this.id} seems to be lost. Cleaning up...`);
    this.cleanClose();
  }

  cleanClose() {
    this._ws.close();
  }

  onClose() {
    console.log(`socket closed for ${this.id}`);
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
    }
    this._server.removeHandler(this);
  }

  onMessage(message) {
    this._lastActivity = new Date();
    try {
      var jsonMessage = JSON.parse(message);
    } catch(e) {
      console.error(`Impossible to parse receieved message ${message}`);
      this.sendError('Badly formatted JSON data');
      return;
    }
    if (jsonMessage.type === 'hello') {
      this.id = WallHandler.nextId();
      if (jsonMessage.data.eventId) {
        console.log(jsonMessage.eventId);
        this._eventManager = EventManager.getForId(jsonMessage.data.eventId);
      } else {
        if (!jsonMessage.data.userId) {
          this.sendError('You must specify a userId or an eventId');
          return;
        }
        this._eventManager = EventManager.getLatestForUser(jsonMessage.data.userId);
      }
      if (this._eventManager === null) {
        this.sendError('Event does not exist');
        this.cleanClose();
        return;
      }
      this._eventManager.addListener(this);
      this.sendMessage('hello', {
        wallId: this.id,
        event: WallServer.eventToWallEvent(this._eventManager.event)
      });
    } else if (jsonMessage.type === 'requestContent') {
      if (this._eventManager) {
        var dateStart = jsonMessage.dateStart ? new Date(Date.parse(jsonMessage.dateStart)) : null;
        var dateEnd  = jsonMessage.dateEnd ? new Date(Date.parse(jsonMessage.dateEnd)) : null;
        var requestParams = {
          valid: true,
          dateStart: dateStart,
          dateEnd: dateEnd,
          count: jsonMessage.count ? jsonMessage.count : 0,
          start: jsonMessage.start ? jsonMessage.start : 0
        };
        var result = this._eventManager.getEventContents(requestParams, (error, eventContents) => {
          if (error) {
            this.sendError(`Could not fetch content. Error received:${error}`);
            return;
          }
          var sendData = [];
          for (var i = 0; i < eventContents.length; i++) {
            sendData.push(WallServer.eventContentToWallContent(eventContents[i]));
          }
          this.sendMessage('newContent', sendData);
        });
      } else {
        this.sendError("No event selected.");
      }
    } else if (jsonMessage.type === 'ping') {
      // Do nothing
    } else if (jsonMessage.type === 'goodbye') {
      this.cleanClose();
    }
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    this._timeout = setTimeout(this.onTimeout.bind(this), config.inactivityTimeout * 1000);
  }

  onNotify(type, eventContents) {
    var sendData = [];
    var sendType;
    if (type === 'new') {
      sendType = 'newContent';
      for (var i = 0; i < eventContents.length; i++) {
        var eventContent = eventContents[i];
        var cont = WallServer.eventContentToWallContent(eventContent);
        sendData.push(cont);
      }
    } else if (type === 'deleted') {
      sendType = 'deletedContent'
      for (var i = 0; i < eventContents.length; i++) {
        var eventContent = eventContents[i];
        sendData.push(eventContent._id);
      }
    } else if (type === 'modified') {
      sendType = 'modifiedContent';
      for (var i = 0; i < eventContents.length; i++) {
        var eventContent = eventContents[i];
        var cont = WallServer.eventContentToWallContent(eventContent);
        sendData.push(cont);
      }
    } else if (type === 'modifiedEvent') {
      sendType = 'modifiedEvent';
      sendData = WallServer.eventToWallEvent(eventContents);
    } else {
      sendType = 'nop';
    }
    this.sendMessage(sendType, sendData);
  }

  sendError(message) {
    var sendObject = {
      type: 'error',
      data: message
    }
    try {
      this._ws.send(JSON.stringify(sendObject));
    } catch (e) {
      this.cleanClose();
    }
  }

  sendMessage(type, data) {
    var sendObject = {
      type: type,
      data: data
    }
    try {
      this._ws.send(JSON.stringify(sendObject));
    } catch (e) {
      this.cleanClose();
    }
  }

  revive(ws) {
    this._ws.close();
    this._ws = ws;
  }

  static nextId() {
    lastId++;
    if (lastId > MAX_ID)
      lastId = 1;
    return lastId;
  }
}

module.exports = exports = WallServer;