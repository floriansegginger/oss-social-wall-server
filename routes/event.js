let fs = require('fs');
let moment = require('moment');
let mongoose = require('mongoose');

let Event = require(__dirname + '/../models/data/event');
let EventManager = require(__dirname + '/../models/eventManager');
let HttpServer = require(__dirname + '/../models/servers/httpServer');
let contentFactory = require(__dirname + '/../models/contentFactory');
let config = require(__dirname + '/../config');

let User = mongoose.model('User');

var toProcess = 0;
var errors = [];

function handleRequest(event, errors, req, isNew, callback) {
  event.name = req.body.name;
  event.location = req.body.location;
  event.url = req.body.url;
  event.description = req.body.description;

  var oldDateStart = event.dateStart;
  var oldDateEnd = event.dateEnd;
  var updateContents = false;

  console.log(req.body.dateStart);

  moment.locale('fr-ch');
  if (!moment(req.body.dateStart, 'L LT').isValid()
      || !moment(req.body.dateEnd, 'L LT').isValid()) {
    errors.push(`Vous devez spécifier une date de début et une date de fin valides.`);
  }

  event.dateStart = moment(req.body.dateStart, 'L LT').toDate();
  event.dateEnd = moment(req.body.dateEnd, 'L LT').toDate();

  if (isNew || oldDateStart.getTime() !== event.dateStart.getTime()) {
    updateContents = true;
  }
  if (isNew || oldDateEnd.getTime() !== event.dateEnd.getTime()) {
    updateContents = true;
  }

  event.displayParameters = {
    backgroundImage: event.displayParameters.backgroundImage,
    logo: event.displayParameters.logo,
    borderSize: req.body['displayParameters.borderSize'],
    fontSize: req.body['displayParameters.fontSize'],
    spacing: req.body['displayParameters.spacing'],
    columns: req.body['displayParameters.columns'],
    font: req.body['displayParameters.font'],
    colors: {
      text: req.body['displayParameters.colors.text'],
      background: req.body['displayParameters.colors.background'],
      border: req.body['displayParameters.colors.border'],
      content: req.body['displayParameters.colors.content'],
      titleBackground: req.body['displayParameters.colors.titleBackground'],
      titleText: req.body['displayParameters.colors.titleText']
    },
    showWallOnWebappPost: req.body['displayParameters.showWallOnWebappPost'],
    askCompany: req.body['displayParameters.askCompany'],
    simpleDisplay: req.body['displayParameters.simpleDisplay']
  };

  if (event.dateStart > event.dateEnd) {
    errors.push('La date de fin doit être ultérieure à la date de début.');
  }

  if (event.name.length === 0) {
    errors.push('Le nom doit faire minimum 1 caractère.');
  }

  // parse sources
  var oldSources = '';
  for (var i = 0; i < event.sources.length; i++) {
    oldSources += event.sources[i].type + ':';
    oldSources += contentFactory.filterToText(event.sources[i].type, event.sources[i].parameters);
    // if (event.sources[i].type === 'twitter') {
    //   oldSources += event.sources[i].parameters.hashtag;
    // } else if (event.sources[i].type === 'facebook') {
    //   oldSources += event.sources[i].parameters.url;
    // }
    oldSources += '\n';
  }
  if (oldSources !== sourcesCleaned) {
    updateContents = true;
  }

  var sources = [];
  var sourcesCleaned = req.body.sourcesAsText
    .replace(/\r/g, "\n")
    .replace(/\n\n/g,"\n");

  if (sourcesCleaned.length > 0) {
    var sourceLines = sourcesCleaned.split("\n");
    for (var i in sourceLines) {
      matches = /^(.+?)\:([^ ]+) ?(.*)$/.exec(sourceLines[i]);
      if (matches === null) {
        errors.push(`La ligne de source '${sourceLines[i]} n'est pas valable.`);
        break;
      }
      var newSource = {};
      newSource = {
        type: matches[1],
        parameters: contentFactory.textToFilter(matches[1], matches[2]),
        text: (typeof matches[3] !== 'undefined')?matches[3]:''
      }
      // if (matches[1] === 'twitter') {
      //   newSource = {
      //     type: 'twitter',
      //     parameters: {hashtag: matches[2]}
      //   };
      // } else if (matches[1] === 'facebook') {
      //   newSource = {
      //     type: 'facebook',
      //     parameters: {url: matches[2]}
      //   };
      // }else {
      //   errors.push(`Malheureusement, la source '${matches[1]}' n'est pas encore fonctionnelle`);
      //   break;
      // }
      sources.push(newSource);
    }
    console.log(sourceLines);
  }

  event.sources = sources;

  // Move images
  if (req.files.logo) {
    toProcess++;
    processImageUpload(req.files.logo[0], 'logo', event, errors, onFinishProcessing.bind(this, req, updateContents, event, errors, callback));
  }
  if (req.files.backgroundImage) {
    toProcess++;
    processImageUpload(req.files.backgroundImage[0], 'backgroundImage', event, errors, onFinishProcessing.bind(this, req, updateContents, event, errors, callback));
  }

  if (toProcess === 0) {
    onFinishProcessing(req, updateContents, event, errors, callback);
  }
}

function onFinishProcessing(req, updateContents, event, errors, callback) {
  if (toProcess !== 0) {
    return;
  }
  if (errors.length === 0){
    event.markModified('sources');
    event.markModified('displayParameters');
    event.save(function onEventSaved(error, savedEvent){
      if (error) {
        console.error("Error saving event");
        console.error(error);
        callback(error, savedEvent)
        return;
      }
      var em = EventManager.getForId(savedEvent._id);
      if (em === null) {
        em = EventManager.createForId(savedEvent._id, (error) => {
          if (error) {
            console.error(error);
          }
        });
      } else {
        em.onEventUpdated(() => {
          if (updateContents) {
            em.updateContents();
          }
        });
      }
      callback(null, savedEvent);
    });
  } else {
    callback(null, event);
  }
  // render(req, res, event, errors, success, false);
}

function processImageUpload(reqFile, fieldName, event, errors, callback) {
  fs.readFile(reqFile.path, function(err, data) {
    var path = 'public/uploads/';
    var splits = reqFile.originalname.toLowerCase().split(".");
    var ext = splits[splits.length - 1];
    var allowedExts = ['png', 'jpg', 'jpeg', 'gif'];
    var found = false;
    for (var i in allowedExts) {
      if (ext.indexOf(allowedExts[i]) != -1) {
        found = true;
        break;
      }
    }
    if (!found) {
      errors.push(`L'image sélectionnée pour '${fieldName}' n'est pas valide`);
      toProcess--;
      callback(event, errors);
      return;
    }
    var dateTime = new Date().getTime();
    var newPath = path + dateTime + '.' + ext;
    event.displayParameters[fieldName] = '/uploads/' + dateTime + '.' + ext;
    fs.writeFile(newPath, data, function(err) {
      if (err) {
        errors.push(err);
      }
      toProcess--;
      callback(event, errors);
    });
  });
}


function render(req, res, editEvent, errors, success, redirect) {
  if (redirect) {
    res.redirect('/');
    return;
  }
  moment.locale('fr-ch');
  res.render('event', {
    user: req.user,
    config: config,
    editEvent: editEvent,
    moment: moment,
    contentFactory: contentFactory,
    location: {
      category: 'events',
      name: (editEvent.name)?`${editEvent.name} | Modification`:`Nouvel événement`
    },
    errors: errors,
    success: success,
    req: req
  });
}

// function handleRequest(event, errors, req, callback, isNewEvent) {
// function onFinishProcessing(req, res, updateContents, event, errors) {

module.exports = exports = function (req, res) {

  if (!req.params.id && req.query.id) {
    req.params.id = req.query.id;
  }

  if (req.params.id) {
    if (!req.user.hasRight('edit', {type: 'event', event: req.params.id})) {
      HttpServer.renderError(res, `Vous n'avez pas le droit de modifier cet événement`);
      return;
    }
  } else {
    if (!req.user.hasRight('create', {type: 'event', event: req.params.id})) {
      HttpServer.renderError(res, `Vous n'avez pas le droit de créer des événements`);
      return;
    }
  }

  if (req.params.id) {
    Event.findOne({_id: req.params.id}).exec((err, event) => {
      if (err) {
        HttpServer.renderError(res, err);
        return;
      }
      if (!event) {
        HttpServer.renderError(res, `Cet événement n'existe pas.`);
        return;
      }
      if (req.query.delete) {
        User.find({})
          .exec((err, users) => {
            if (err) {
              HttpServer.renderError(res, err);
              return;
            }
            var toRemove = 0;
            for (var i = 0; i < users.length; i++) {
              let user = users[i];
              for (var j = 0; j < user.events.length; j++) {
                if (user.events[j].toString() === event._id.toString()) {
                  user.events.splice(j, 1);
                  toRemove++;
                  break;
                }
              }
              user.markModified('events');
              user.save((err, savedUser) => {
                if (err) {
                  HttpServer.renderError(res, err);
                  return;
                }
                toRemove--;
                if (toRemove === 0) {
                  event.deleted = true;
                  event.save((err, savedEvent) => {
                    if (err) {
                      HttpServer.renderError(res, err);
                      return;
                    }
                    EventManager.destroyForId(savedEvent._id);
                    render(req, res, {}, [], true, true);
                  });
                }
              });
            }
          });
        return;
      }
      if (req.body.submit) {
        var errors = [];
        handleRequest(event, errors, req, false, (error, savedEvent) => {
          if (error) {
            HttpServer.renderError(error);
            return;
          }
          var success = (errors.length === 0);
          if (success) {
            render(req, res, newEvent, errors, success, true);
          } else {
            render(req, res, newEvent, errors, success);
          }
        });
      } else {
        render(req, res, event);
      }
    })
  } else {
    if (req.body.submit) {
      var errors = [];
      var newEvent = new Event();
      newEvent.displayParameters = {};
      handleRequest(newEvent, errors, req, true, (dbError, savedEvent) => {
        if (dbError) {
          HttpServer.renderError(res, dbError);
          return;
        }
        var success = (errors.length === 0);
        if (success) {
          req.user.events.push(savedEvent._id);
          req.user.markModified('events');
          req.user.save();
          render(req, res, newEvent, errors, success, true);
        } else {
          render(req, res, newEvent, errors, success);
        }
      }, true);
    } else {
      render(req, res, {});
    }
  }
}