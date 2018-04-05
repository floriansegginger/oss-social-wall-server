let request = require('request');
let mongoose = require('mongoose');

let config = require(__dirname + '/../config');
let InstagramRetriever = require(__dirname + '/../plugins/instagramRetriever');
let Event = mongoose.model('Event');

module.exports = exports = function (req, res) {
  let HttpServer = require(__dirname + '/../models/servers/httpServer');

  if (!req.query.code) {
    HttpServer.renderError(res, `Vous devez autoriser notre application à accéder à vos données Instagram!`);
    return;
  }

  if (!req.query.event) {
    HttpServer.renderError(res, `Aucun événement spécifié. Ceci ne devrait pas se produire.`);
    return;
  }

  InstagramRetriever.InstagramEventToken
    .findOne({event: req.query.event})
    .exec((error, token) => {
      if (error) {
        HttpServer.renderError(res, `Cet événement est introuvable. Ceci ne devrait pas se produire.`);
        return;
      }

      if (!token) {
        token = new InstagramRetriever.InstagramEventToken();
      }

      Event
        .findOne({_id: req.query.event})
        .exec((error, event) => {
          if (error) {
            HttpServer.renderError(res, error);
            return;
          }
          if (!event) {
            HttpServer.renderError(res, `Cet événement n'existe pas.`);
            return;
          }

          request.post('https://api.instagram.com/oauth/access_token', 
            {
              form: {
                client_id: config.instagram.client_id,
                client_secret: config.instagram.client_secret,
                grant_type: 'authorization_code',
                redirect_uri: `http://${config.host}:${config.port}/instagram-get-token?event=${req.query.event}`,
                code: req.query.code
              }
            }, 
            (error, httpResponse, body) => {
              if (error) {
                HttpServer.renderError(res, error);
                return;
              }
              try {
                var info = JSON.parse(body);
                if (!info.access_token) {
                  HttpServer.renderError(res, `Aucun token fourni par Instagram. Informations de debug: ${body}`);
                  return;
                }
                token.event = event._id;
                token.token = info.access_token;
                if (info.user && info.user.username) {
                  token.username = info.user.username;
                } 
                token.save();
                res.render('instagram-get-token', {
                  user: req.user,
                  event: event,
                  location: {
                    category: 'events',
                    name: `${event.name} | Autorisation Instagram`
                  }
                })
              } catch (e) {
                HttpServer.renderError(res, e + ` ${body}`);
              }
            }
          );
        }
      );
    }
  );
}