'use strict';

let express = require('express');
let bodyParser = require('body-parser');
let passport = require('passport');
let session = require('express-session');
let FileStore = require('session-file-store')(session);
let stylus = require('stylus');
let multer = require('multer');

let User = require(__dirname + '/../data/user');
let config = require(__dirname + '/../../config.js');

class HttpServer {
  constructor() {
    this.app = express();

    this.app.use(bodyParser.urlencoded({
      extended: true,
      limit: '64mb'
    }));

    let upload = multer({dest: __dirname + '/../../tmp-uploads'});
    this.app.use('/event/:id?', upload.fields([
      {name:'logo', maxCount:1},
      {name:'backgroundImage', maxCount: 1}
    ]));
    this.app.use('/webapp/:event', upload.single('image'));

    // Stylus for CSS
    this.app.use(stylus.middleware(__dirname + '/../../public'));

    // Static routes like bootstrap and jquery
    this.app.use(express.static(__dirname + '/../../public'));
    this.app.use('/bootstrap', express.static(__dirname + '/../../node_modules/bootstrap/dist'));
    this.app.use('/jquery', express.static(__dirname + '/../../node_modules/jquery/dist'));
    this.app.use('/bootstrap-colorpicker', express.static(__dirname + '/../../node_modules/bootstrap-colorpicker/dist'));
    this.app.use('/bootstrap-slider', express.static(__dirname + '/../../node_modules/bootstrap-slider/dist'));
    this.app.use('/bootstrap-datetimepicker', express.static(__dirname + '/../../node_modules/eonasdan-bootstrap-datetimepicker/build'));
    this.app.use('/moment', express.static(__dirname + '/../../node_modules/moment/min'));
    this.app.use('/bootstrap-switch', express.static(__dirname + '/../../node_modules/bootstrap-switch/dist'));

    this.app.use(session({
      name: 'social-wall-session-id',
      secret:config.sessionSecret,
      resave: true,
      saveUninitialized: true,
      store: new FileStore()
    }));

    this.app.use(passport.initialize());
    this.app.use(passport.session());

    passport.use(User.strategy);
    passport.serializeUser(User.serializeUser);
    passport.deserializeUser(User.deserializeUser);

    this.app.set('view engine', 'pug');
    this._addRoutes();
  }

  _addRoutes() {
    this.app.get('/login', routes.login);
    this.app.post('/login', passport.authenticate('local', {
      successRedirect: '/',
      failureRedirect: '/login'
    }));
    this.app.get('/', User.isAuthenticated, routes.index);
    this.app.all('/event/:id?', User.isAuthenticated, routes.event);
    this.app.all('/eventContents/:id', routes.eventContents);
    this.app.all('/moderate/:id', User.isAuthenticated, routes.moderate);
    this.app.all('/webapp/:event', routes.webapp);
    this.app.all('/wall/:event', routes.wall);
    this.app.get('/logout', User.isAuthenticated, routes.logout);
    this.app.all('/users', User.isAuthenticated, routes.users);
    this.app.all('/user/:id?', User.isAuthenticated, routes.user);
    this.app.get('/instagram-get-token', User.isAuthenticated, routes.instagramGetToken);
    this.app.use(function(req, res, next) {
      HttpServer.renderError(res, `Cette page n'existe pas. Vous ne devriez pas avoir vu cette page. Si cette erreur persiste, contactez l'opérateur.`, 404)
    });
  }

  static renderError(res, message, status = 500) {
    console.error(`[HttpServer] Error (${status}) ${message}`);
    res.status(status).render('error', {error: message, location: {category:'error', name: 'Erreur'}});
  }

  static jsonError(res, message) {
    res.status(500).json({error: message});
  }
}

module.exports = exports = HttpServer;

const __routes = __dirname + '/../../routes/';
let routes = {
  login: require(__routes + 'login'),
  index: require(__routes + 'index'),
  logout: require(__routes + 'logout'),
  moderate: require(__routes + 'moderate'),
  event: require(__routes + 'event'),
  eventContents: require(__routes + 'eventContents'),
  webapp: require(__routes + 'webapp'),
  wall: require(__routes + 'wall'),
  users: require(__routes + 'users'),
  user: require(__routes + 'user'),
  instagramGetToken: require(__routes + 'instagramGetToken')
}
