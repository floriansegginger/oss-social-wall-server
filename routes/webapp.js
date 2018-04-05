let fs = require('fs');
let moment = require('moment');
let gm = require('gm')
let imageType = require('image-type');
let ent = require('ent');

let Event = require(__dirname + '/../models/data/event');
let WebappPost = require(__dirname + '/../models/data/webappPost');
let config = require(__dirname + '/../config');

const INTERNAL_UPLOADS_DIR = __dirname + '/../public/uploads/';
const INTERNAL_PUBLIC_DIR = __dirname + '/../public';
const PUBLIC_UPLOADS_DIR = '/uploads/';

const allowedExts = ['png','jpg','jpeg','gif'];

module.exports = exports = function (req, res) {
  res.header('Access-Control-Allow-Origin', '*');

  let HttpServer = require(__dirname + '/../models/servers/httpServer');

  if ( req.file ){
      var fd = fs.openSync(req.file.path, 'r');
      var buf = new Buffer(12);
      var nread = fs.readSync(fd, buf, 0, 12, 0);
      var type = imageType(buf);
      if (type === null || (type.ext !== 'jpg' && type.ext !== 'png' && type.ext !== 'gif')) {
          res.status(400).send("Seul les JPEG, PNG et GIF sont supportés!");
          return;
      }
      fs.readFile(req.file.path, function (err, data) {
          var path = INTERNAL_UPLOADS_DIR;
          var splits = req.file.originalname.toLowerCase().split(".");
          var ext = splits[splits.length-1];
          var found = false;
          for ( var i in allowedExts ){
              if ( ext.indexOf(allowedExts[i]) != -1 ){
                  found = true;
                  break;
              }
          }
          if ( !found ){
              res.status(500).send("Ce type de fichier n'est pas accepté");
              return;
          }
          var dateTime = new Date().getTime();
          var newPath = path + dateTime + '.' + ext;
          var publicPath = PUBLIC_UPLOADS_DIR + dateTime + '.' + ext;
          fs.writeFile(newPath, data, function (err) {
              gm(newPath).resize(config.images.maxWidth,config.images.maxHeight, '>').autoOrient().write(newPath,function (err){
                  res.json({url:publicPath});
              });
          });
      });
  } else if ( req.body.base64Image ){
      var path = INTERNAL_UPLOADS_DIR;
      var ext = req.body.imageFormat;
      var found = false;
      for ( var i in allowedExts ){
          if ( ext.indexOf(allowedExts[i]) != -1 ){
              found = true;
              break;
          }
      }
      if ( !found ){
          res.status(500).send("Ce type de fichier n'est pas accepté");
          return;
      }

      var dateTime = new Date().getTime();
      var newPath = path + dateTime + '.' + ext;
      var publicPath = PUBLIC_UPLOADS_DIR + dateTime + '.' + ext;

      base64Image = req.body.base64Image.replace("data:image/" + ext + ";base64,", "");
      var data = new Buffer(base64Image, 'base64');
      var type = imageType(data);
      if (type === null || (type.ext !== 'jpg' && type.ext !== 'png' && type.ext !== 'gif')) {
          res.status(400).send("Seul les JPEG, PNG et GIF sont supportés!");
          return;
      }

      fs.writeFile(newPath, data, function (err) {
          gm(newPath).resize(config.images.maxWidth,config.images.maxHeight, '>').autoOrient().write(newPath,function (err){
              res.json({url:publicPath});
          });
      });
  }else if (req.query.getEventInfo) {
    if (!req.params.event) {
      HttpServer.jsonError(res, 'Aucun événement spécifié.');
      return;
    }

    Event.findOne({_id: req.params.event}, function (error, event) {
      if (error) {
        HttpServer.jsonError(res, `Cet événement n'existe plus ou n'a jamais existé`);
        return;
      }

      eventFiltered = event.toObject();
      delete eventFiltered.user;
      delete eventFiltered.sources;
      delete eventFiltered.__v;

      res.json(eventFiltered);
    });
  } else if (req.body.text && req.body.username) {
    if (!req.params.event) {
      HttpServer.jsonError(res, 'Aucun événement spécifié.');
      return;
    }

    Event.findOne({_id: req.params.event}, function (error, event) {
      if (error) {
        res.status(400).send(`Cet événement n'existe plus ou n'a jamais existé`);
        return;
      }

      var dateStart = moment(event.dateStart);
      var dateEnd = moment(event.dateEnd);

      if (moment().isBefore(dateStart) || moment().isAfter(dateEnd)) {
        res.status(400).send(`Cet événement n'a pas encore commencé ou est déjà terminé.`);
        return;
      }

      if (req.body.username.length < 2) {
        res.status(400).send(`Votre nom d'utilisateur doit faire minimum 2 caractères`);
        return;
      }

      if (req.body.text.length < 2) {
        res.status(400).send(`Votre message doit faire minimum 2 caractères`);
        return;
      }

      if (req.body.media) {
        try {
          fs.statSync(INTERNAL_PUBLIC_DIR + req.body.media.url);
        } catch (e) {
          res.status(400).send(`Image invalide`);
          return;
        }
      }

      var newPost = new WebappPost();
      newPost.event = event._id;
      newPost.date = new Date();
      newPost.username = ent.encode(req.body.username);
      if (req.body.company)
        newPost.company = ent.encode(req.body.company);
      newPost.text = ent.encode(req.body.text);
      if (req.body.media) {
        newPost.media = {
          type: (req.body.media.type === 'image')?'image':'video',
          url: req.body.media.url
        };
      }
      newPost.save(function (error, savedPost) {
        if (error) {
          res.status(400).send(`Image invalide`);
          return;
        }
        res.json(savedPost)
      })
    });
  } else {
    HttpServer.jsonError(res, 'Mauvaise requête.');
  }
}