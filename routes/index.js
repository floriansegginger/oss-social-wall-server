let moment = require('moment');

let Event = require(__dirname + '/../models/data/event');
let contentFactory = require(__dirname + '/../models/contentFactory');

module.exports = exports = function (req, res) {
  let HttpServer = require(__dirname + '/../models/servers/httpServer');

  Event.find({_id: {$in: req.user.events}}).exec(function (err, events) {
    if (err) {
      HttpServer.renderError(res, err);
      return;
    }
    res.render('index', {
      user: req.user,
      events: events,
      contentFactory: contentFactory,
      moment: moment, location: {
        category: 'events',
        name: `Mes événements`
      }
    })
  });
}