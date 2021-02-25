require('dotenv').config();
const path = require('path');
//const fs=require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mongoose = require('mongoose');
const errorController = require('./controllers/error');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);//upar walla
const User = require('./models/user');
const csrf = require('csurf');

const MONGODB_URI = "mongodb://abc:123@cluster0-shard-00-00.1hcdx.mongodb.net:27017,cluster0-shard-00-01.1hcdx.mongodb.net:27017,cluster0-shard-00-02.1hcdx.mongodb.net:27017/shop?ssl=true&replicaSet=atlas-5tm0i2-shard-0&authSource=admin&retryWrites=true&w=majority";
//const MONGODB_URI = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-shard-00-00.1hcdx.mongodb.net:27017,cluster0-shard-00-01.1hcdx.mongodb.net:27017,cluster0-shard-00-02.1hcdx.mongodb.net:27017/${process.env.MONGO_DEFAULT_USER}?ssl=true&replicaSet=atlas-5tm0i2-shard-0&authSource=admin&retryWrites=true&w=majority`;
const flash = require('connect-flash');
const multer = require('multer');

const passport = require('passport');
const findOrCreate = require('mongoose-findorcreate');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});


const csrfProtection = csrf();
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }


};
app.set('view engine', 'ejs');//to set the template we are going to use is ejs
app.set('views', 'views');//to set the default directory of templates is views folder

/
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
app.use(bodyParser.urlencoded({ extended: false }));

app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'))

//app.use(express.static("public"));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(
  session({ secret: 'my secret', resave: false, saveUninitialized: false, store: store }))//to store session data 

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;//it is needed everwhere so just once write it
  res.locals.csrfToken = req.csrfToken();
  next();
});


app.use(passport.initialize());
app.use(passport.session())
//User.plugin()

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({

  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/products",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
  function (accessToken, refreshToken, profile, cb) {
    console.log("-------profile-----");
    console.log(profile.emails[0].value);

    User.findOrCreate({ googleId: profile.id, email: profile.emails[0].value }, function (err, user) {
      console.log(err);
      return cb(err, user);
    });
  }
));

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();///if there is user then move forward
  }
  User.findById(req.session.user._id)

    .then(user => {
      if (!user) {
        return next();
      }
      req.user = user;///for user
      next();
    })
    .catch(err => {
      next(new Error(err))
    });
});


app.get('/auth/google',
  passport.authenticate('google', { scope: ["profile", "email"] })
);
app.get('/auth/google/products',

  passport.authenticate('google', { failureRedirect: '/signup' }),
  function (req, res) {
    req.session.isLoggedIn = true;


    res.redirect('/');
  });



app.use(shopRoutes);
app.use('/admin', adminRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);

app.use(errorController.get404);///this is written in the end so that all the remaining cases fall here

///error 
app.use((error, req, res, next) => {
  console.log(error);

  res.status(500).render('500', {
    pageTitle: 'Page Not Found',
    path: '/500',
    isAuthenticated: req.session.isLoggedIn

  });
})

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(result => {

    app.listen(process.env.PORT || 3000, (req, res, next) => {
      console.log('running');
    })

  }).catch(err => {
    console.log(err);
  });
mongoose.set('useCreateIndex', true);