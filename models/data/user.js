'use strict';

let mongoose = require('mongoose');
let crypto = require('crypto');
let LocalStrategy = require('passport-local').Strategy;
let passwordHash = require('password-hash');

const LEVEL_ADMIN = 3;
const LEVEL_CUSTOMER = 2;
const LEVEL_MODERATOR = 1;

var userSchema = mongoose.Schema({
  name: {type: String, unique: true},
  email: String,
  password: String,
  // There are 3 levels of user
  // * admin => can do everything
  // * client => can create, modify events
  // * moderator => can only moderate, not edit events, etc.
  level: {type: Number, enum: [LEVEL_ADMIN, LEVEL_CUSTOMER, LEVEL_MODERATOR]},
  users: [{type: mongoose.Schema.ObjectId, ref: 'User'}],
  events: [{type: mongoose.Schema.ObjectId, ref:'Event'}],
  creationDate: {type: Date, default: Date.now},
  lastModifyDate: {type: Date, default: Date.now},
  // Boring business stuff
  company: String,
  billingAddress: String,
  vatNumber: String
});

userSchema.methods.hasRight = function (action, data) {
  if (this.level === LEVEL_ADMIN){
    return true;
  }
  var rightsStructure = {
    create: {
      event: () => this.level >= LEVEL_CUSTOMER,
      users: () => this.level >= LEVEL_CUSTOMER
    },
    edit:{
      event: (data) => 
        this.level >= LEVEL_CUSTOMER 
        && this.events.find((e) => e._id.toString() == data.event) != undefined,
      user: (data) => 
        data.user == this._id
        || this.level >= LEVEL_CUSTOMER && this.users.indexOf(data.user) >= 0,
      users: () => this.level >= LEVEL_CUSTOMER,
      'user-events': (data) => 
        this.level >= LEVEL_CUSTOMER
        || (data.event && this.level >= LEVEL_CUSTOMER && this.events.indexOf(data.event) >= 0),
      billing: () => this.level >= LEVEL_CUSTOMER,
      username: () => this.level >= LEVEL_ADMIN,
    },
    moderate: {
      event: (data) => 
        this.level >= LEVEL_MODERATOR
        && this.events.find((e) => e._id.toString() == data.event) != undefined,
    },
    view: {
      event: (data) => 
        this.level >= LEVEL_MODERATOR
        && this.events.find((e) => e._id.toString() == data.event) != undefined,
      user: () => this.level >= LEVEL_MODERATOR
    }
  }

  if (typeof rightsStructure[action] !== 'undefined') {
    if (typeof rightsStructure[action][data.type] === 'function') {
      return rightsStructure[action][data.type].call(this, data);
    }
    return false;
  }
  return false;
}

userSchema.methods.checkPassword = function (password) {
  return passwordHash.verify(password, this.password);
}

var User = mongoose.model('User', userSchema);

User.LEVEL_ADMIN = LEVEL_ADMIN;
User.LEVEL_CUSTOMER = LEVEL_CUSTOMER;
User.LEVEL_MODERATOR = LEVEL_MODERATOR;

User.strategy = new LocalStrategy({
  usernameField: 'name',
  passwordField: 'password'
}, function(name, password, done) {
  User.findOne({ name: name })
    .populate('events')
    .exec(function (err, user) {
      if (err) {
        return done(err);
      }

      if (!user) {
        return done(null, false, { message: 'Incorrect user.' });
      }

      if (!user.checkPassword(password)) {
        console.log("wrong pass");
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    }
  );
});

User.serializeUser = function (user, done) {
  done(null, user.id);
};

User.deserializeUser = function (id, done) {
  User.findOne({_id: id}).
    populate('events')
    .exec(function(err, user) {
      if (err) done();

      return done(null, user);
    }
  );
};

User.signup = function (name, email, password, level, done) {
  var User = this;
  var hash = passwordHash.generate(password);
  var newUser = new User();
  newUser.name = name;
  newUser.password = hash;
  newUser.email = email;
  newUser.level = level;
  newUser.events = [];
  newUser.users = [];
  newUser.save(done);
}

User.isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login");
  }
}

User.isAdmin = function (req, res, next) {
  if (req.isAuthenticated()) {
    if (req.user.admin === true) {
      next();
    } else {
      res.render("unauthorized", { title: 'Erreur' });
    }
  } else {
    res.redirect("/")
  }
}

User.getHash = function (password) {
  return passwordHash.generate(password);
}

module.exports = exports = User;

let Event = require(__dirname + '/event');