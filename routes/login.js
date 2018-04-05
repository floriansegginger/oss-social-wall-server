module.exports = exports = function (req, res) {
  if ( !req.isAuthenticated() ){
    res.render("login", {location: {
      category: 'login',
      name: `Bienvenue`
    }});
  }else{
    res.redirect("/");
  }
};