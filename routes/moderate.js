let Event = require(__dirname + '/../models/data/event');
let EventManager = require(__dirname + '/../models/eventManager');

module.exports = exports = function (req, res) {
  let HttpServer = require(__dirname + '/../models/servers/httpServer');
  
  if (!req.user.hasRight('moderate', {type: 'event', event: req.params.id})) {
    HttpServer.renderError(res, `Vous n'avez pas le droit de modérer cet événement.`);
    return;
  }

  if (typeof req.body.eventContent !== 'undefined') {
    var manager = EventManager.getForId(req.params.id);
    if (!manager) {
      HttpServer.renderError(res, `Cet événement n'existe pas`);
      return;
    }

    if (typeof req.body.valid !== 'undefined') {
      var valid = (req.body.valid === '1')?true:false;
      manager.moderate(req.body.eventContent, valid, (error) => {
        if (error) {
          HttpServer.jsonError(res, error);
          return;
        }
        res.send("OK");
      });
    } else if (typeof req.body.pinned !== 'undefined') {
      var pinned = (req.body.pinned === '1')?true:false;
      manager.pin(req.body.eventContent, pinned, (error) => {
        if (error) {
          HttpServer.jsonError(res, error);
          return;
        }
        res.send("OK");
      });
    } else if (typeof req.body.selected !== 'undefined') {
      var selected = (req.body.selected === '1')?true:false;
      manager.select(req.body.eventContent, selected, (error) => {
        if (error) {
          HttpServer.jsonError(res, error);
          return;
        }
        res.send("OK");
      });
    }
    return;
  }

  if (typeof req.body.moderateNewContent !== 'undefined') {
    var manager = EventManager.getForId(req.params.id);
    if (!manager) {
      HttpServer.renderError(res, `Cet événement n'existe pas.`);
    }
    Event.findOne({_id: req.params.id}).exec((err, event) => {
      if (err) {
        HttpServer.jsonError(res, err);
        return;
      }
      event.moderateNewContent = (req.body.moderateNewContent === '1')?true:false;
      event.save((err, savedEvent) => {
        if (err) {
          HttpServer.jsonError(res, err);
          return;
        }
        manager.onEventUpdated(() => {});
        res.send('OK');
      })
    });
    return;
  }

  Event.findOne({_id: req.params.id}).exec((err, event) => {
    if (err) {
      HttpServer.renderError(res, err);
      return;
    }
    if (!event) {
      HttpServer.renderError(res, `Cet événement n'existe pas.`);
      return;
    }
    res.render('moderate', {user: req.user, event: event, session: req.session, location: {
      category: 'events',
      name: `${event.name} | Modération`
    }});
  });
};