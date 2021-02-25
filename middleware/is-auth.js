module.exports = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login')
    }
    next();
}
///taki sab jagah ye  laga dia jai jaha jaha bina login ke page access nhi hona chahiye