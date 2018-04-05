'use strict';

let mongoose = require('mongoose');
// Plug-in the standard promises library to kill mongoose's warning
mongoose.Promise = global.Promise;

let masterServer = require('http').createServer();

let User = require('./models/data/user');
let Content = require('./models/data/content');
let Event = require('./models/data/event');
let EventContent = require('./models/data/eventContent');
let WebappPost = require('./models/data/webappPost');

let config = require('./config');

let HttpServer = require('./models/servers/httpServer');
let WallServer = require('./models/servers/wallServer');

let EventManager = require('./models/eventManager');
let contentFactory = require('./models/contentFactory');

// Connect to the database
mongoose.connect(config.databaseString);
let dbConnection = mongoose.connection;
dbConnection.on('error', (error) => {
  console.error(error);
});
dbConnection.once('open', () => {
  console.log('Connected to database');
  // Initialize the content factory
  contentFactory.loadPlugins(__dirname + "/plugins", function onPluginsLoaded() {
    // Create a content manager for every event in the DB
    EventManager.loadAll(function onEventManagerLoaded() {
      masterServer.listen(config.port, function onMasterServerStarted() {
        console.log('server listening on port 8000');
      });
    });
  });
});

var mainHttpServer = new HttpServer();
var mainWallServer = new WallServer(masterServer);

masterServer.on('request', mainHttpServer.app);

process.on('unhandledRejection', function onUnhandledRejection(err) {
  console.error('Unhandled Rejection Exception');
  throw err;
})