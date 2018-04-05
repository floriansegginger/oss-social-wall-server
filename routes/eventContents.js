let Event = require(__dirname + '/../models/data/event');
let EventManager = require(__dirname + '/../models/eventManager');

module.exports = exports = function (req, res) {
  res.header('Access-Control-Allow-Origin', '*');

  let HttpServer = require(__dirname + '/../models/servers/httpServer');
  
  if (!req.user.hasRight('view', {type: 'event', event: req.params.id})) {
    HttpServer.jsonError(res, `Vous n'avez pas le droit d'obtenir les contenus de cet événement.`);
    return;
  }

  var eventManager = EventManager.getForId(req.params.id);
  if (eventManager === null) {
    res.status(404).send("Event not found");
    return;
  }
  var valid = undefined;
  if (req.query.valid === '1')
    valid = true;
  else if (req.query.valid === '0')
    valud = false;
  let dateStart = Date.parse(req.query.dateStart);
  let dateEnd = Date.parse(req.query.dateEnd);
  let count = parseInt(req.query.count);
  let start = parseInt(req.query.start);
  eventManager.getEventContents({
    valid: valid,
    dateStart: isNaN(dateStart)?null:dateStart,
    dateEnd: isNaN(dateEnd)?null:dateEnd,
    count: isNaN(count)?undefined:count,
    start: isNaN(start)?undefined:start
  }, (err, eventContents) => {
    if (err) {
      HttpServer.jsonError(res, err);
      return;
    }
    res.json(eventContents);
  });
};