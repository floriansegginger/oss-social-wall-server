module.exports = exports = function (req, res) {
  req.logout();
  res.redirect('/login');
}