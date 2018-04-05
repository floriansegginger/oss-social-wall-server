let Event = require(__dirname + '/../models/data/event');
let EventManager = require(__dirname + '/../models/eventManager');
let WallServer = require(__dirname + '/../models/servers/wallServer');

module.exports = exports = function (req, res) {
  res.header('Access-Control-Allow-Origin', '*');

  let HttpServer = require(__dirname + '/../models/servers/httpServer');
  
  var eventManager = EventManager.getForId(req.params.event);
  if (eventManager === null) {
    HttpServer.jsonError(res, "Event not found");
    return;
  }

  if (req.query.type === 'hello') {
    res.send({
      type: 'hello',
      data: {
        event: WallServer.eventToWallEvent(eventManager.event)
      }
    })
  } else if (req.query.type === 'requestContent') {
    var valid = true;
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
      var sendContent = [];
      for (var i = 0; i < eventContents.length; i++) {
        sendContent.push(WallServer.eventContentToWallContent(eventContents[i]));
      }
      res.json({
        type: 'newContent',
        data: sendContent
      });
    });
  }
};