let moment = require('moment');

let User = require(__dirname + '/../models/data/user');

module.exports = exports = function (req, res) {
  let HttpServer = require(__dirname + '/../models/servers/httpServer');

  if (!req.user.hasRight('create',{type: 'users'})) {
    HttpServer.renderError(res, `Vous n'avez pas le droit de créer des utilisateurs`);
    return;
  }

  var selector = {_id: {$in: req.user.users}};
  if (req.user.level >= User.LEVEL_ADMIN) {
    selector = {};
  }

  User.find(selector)
    .populate('events')
    .exec(function (err, users) {
      if (err) {
        HttpServer.renderError(res, err);
        return;
      }
      res.render('users', {user: req.user, users: users, moment: moment, location: {
        category: 'users',
        name: `Utilisateurs`
      }})
  });
}