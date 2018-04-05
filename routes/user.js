let moment = require('moment');

let User = require(__dirname + '/../models/data/user');

function handleRequest(user, errors, req, callback, isNewUser) {
  user.name = req.body.name;
  user.email = req.body.email;
  user.company = req.body.company;
  user.billingAddress = req.body.billingAddress;
  user.vatNumber = req.body.vatNumber;

  if (user.name.length < 2) {
    errors.push(`La longueur minimale du nom d'utilisateur est de 2 caractères.`);
  }

  if (!user.email.match(/.+@.+\..+/ig)) {
    errors.push(`Votre adresse e-mail n'a pas l'air valable.`);
  }

  if (req.body.newPassword != req.body.confirmPassword) {
    errors.push(`Les deux mots de passes ne correspondent pas`);
  }

  if (isNewUser && req.body.newPassword.length < 1) {
    errors.push(`Vous devez choisir un mot de passe.`);
  }

  if (req.body.newPassword.length !== 0 
    && user._id
    && req.user._id.toString() === user._id.toString()
    && !user.checkPassword(req.body.currentPassword)) {
    errors.push(`Pour définir un nouveau mot de passe, vous devez saisir votre mot de passe actuel correctement.`);
  }

  if (errors.length === 0 
    && req.body.newPassword.length > 0 
    && req.body.newPassword.length < 5) {
    errors.push(`La longueur minimale du mot de passe est 5 caractères.`);
  }

  if (errors.length === 0 && req.body.newPassword.length !== 0) {
    user.password = User.getHash(req.body.newPassword);
  }

  if (!user._id || (user._id.toString() !== req.user._id.toString())) {
    user.events = [];
    if (req.body.events) {
      for (var i = 0; i < req.body.events.length; i++) {
        var e = req.body.events[i];
        console.log(e);
        if (req.user.hasRight('edit', {type: 'user-events', event: e})) {
          user.events.push(e);
        }
      }
      console.log(user.events);
    }
    user.markModified('events');
  }

  User.findOne({name: user.name}, function (err, foundUser) {
    if (err || foundUser !== null && foundUser._id.toString() !== user._id.toString()) {
      console.log('user exists');
      errors.push(`Ce nom d'utilisateur est déjà pris`);
      callback(err, user);
      return;
    }
    if (errors.length === 0) {
      console.log('SAVED');
      user.save(callback);
    } else {
      callback(err, user);
    }
  })
}

function render(res, req, editUser, errors, success, redirect) {
  if (redirect) {
    res.redirect('/users');
    return;
  }
  res.render('user', {
    user: req.user, 
    editUser: editUser,
    moment: moment,
    location: {
      category: (editUser._id && editUser._id.toString() === req.user._id.toString())?'profile':'users',
      name: (editUser.name)?`${editUser.name} | Modification`:`Nouvel utilisateur`
    },
    errors: errors,
    success: success,
    req: req
  });
}

module.exports = exports = function (req, res) {
  let HttpServer = require(__dirname + '/../models/servers/httpServer');

  if (req.params.id) {
    if (!req.user.hasRight('edit',{type: 'user', user: req.params.id})) {
      HttpServer.renderError(res, `Vous n'avez pas le droit de modifier des utilisateurs`);
      return;
    }
  } else {
    if (!req.user.hasRight('create',{type: 'users'})) {
      HttpServer.renderError(res, `Vous n'avez pas le droit de créer des utilisateurs`);
      return;
    }
  }

  if (req.params.id) {
    User.findOne({_id: req.params.id}, function (err, editUser) {
      if (err) {
        HttpServer.renderError(res, err);
        return;
      }
      if (!editUser) {
        HttpServer.renderError(res, `Cet utilisateur n'existe pas.`);
        return;
      }

      if (req.body.submit) {
        var errors = [];
        handleRequest(editUser, errors, req, (dbError, savedUser) => {
          if (dbError) {
            HttpServer.renderError(res, dbError);
            return;
          }
          var success = (errors.length === 0);
          render(res, req, savedUser, errors, success);
        });
      } else {
        render(res, req, editUser);
      }
    });
  } else {
    if (req.body.submit) {
      var errors = [];
      var newUser = new User();
      newUser.level = User.LEVEL_MODERATOR;
      handleRequest(newUser, errors, req, (dbError, savedUser) => {
        if (dbError) {
          HttpServer.renderError(res, dbError);
          return;
        }
        var success = (errors.length === 0);
        if (success) {
          req.user.users.push(savedUser._id);
          req.user.markModified('users');
          req.user.save();
          render(res, req, savedUser, errors, success, true);
        } else {
          render(res, req, savedUser, errors, success);
        }
      }, true);
    } else {
      render(res, req, {});
    }
  }
}