const crypto = require('crypto');//inbuilt libraray of node...nothing to install
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');
const transporter = nodemailer.createTransport(sendgridTransport({
  auth: {

    api_key: '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'
  }
}));

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422)//422 for validation failed
      .render('auth/signup', {
        path: '/signup',
        pageTitle: 'signup',
        errorMessage: errors.array()[0].msg,
        oldInput: { email: email, password: password, confirmPassword: req.body.confirmPassword },
        validationErrors: errors.array()//for all the elemnts in the array
      });
  }

  bcrypt.hash(password, 12)

    .then(hashedPassword => {
      const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] }//cart will be empty in the begining
      });
      return user.save();
    })
    .then(result => {
      res.redirect('/login');
      return transporter.sendMail({
        to: email,
        from: 'riya.rashi141@gmail.com',
        subject: 'signup suceeded',
        html: '<h1>welcome successfully signed up!!</h1>'
      });

    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);///next containing an error means it will skip all other middleware and directly handle the error
    })


}
exports.getSignup = (req, res, next) => {
  let message = req.flash('error');//req.flash ke array deta hai vid 17 validation
  if (message.length > 0) {
    message = message[0];
  }
  else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'signup',
    errorMessage: message,
    oldInput: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []//for csss styling we need this aaray


  });

};

exports.getLogin = (req, res, next) => {
  let message = req.flash('error');//req.flash ke array deta hai vid 17 validation
  if (message.length > 0) {
    message = message[0];
  }
  else {
    message = null;
  }

  res.render('auth/login', {
    path: '/login',
    pageTitle: 'login',
    errorMessage: message,
    oldInput: {
      email: '',
      password: ''
    },
    validationErrors: []
  });

};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422)//422 for validation failed
      .render('auth/login', {
        path: '/login',
        pageTitle: 'login',
        errorMessage: errors.array()[0].msg,
        oldInput: { email: email, password: password },
        validationErrors: errors.array()

      });
  }

  User.findOne({ email: email })

    .then(user => {
      if (!user) {
        // req.flash('error', 'invalid email or password');
        return res.status(422)//422 for validation failed
          .render('auth/login', {
            path: '/login',
            pageTitle: 'login',
            errorMessage: 'invalid email or pw',
            oldInput: { email: email, password: password },
            validationErrors: []

          });
      }
      bcrypt
        .compare(password, user.password)
        .then(doMatch => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              console.log(err);
              res.redirect('/');
              return transporter.sendMail({
                to: email,
                from: 'riya.rashi141@gmail.com',
                subject: 'Login successful',
                html: '<h1>welcome You are logged in !!</h1>'
              });
            });

          }
          return res.status(422)//422 for validation failed
            .render('auth/login', {
              path: '/login',
              pageTitle: 'login',
              errorMessage: 'invalid email or pw',
              oldInput: { email: email, password: password },
              validationErrors: []
              // req.flash('error', 'invalid email or password');
              // res.redirect('/login');
            });
        })
        .catch(err => {
          console.log(err);
          res.redirect('/login')
        });

    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);///next containing an error means it will skip all other middleware and directly handle the error
    });
};
//session cookie deleted when the borwser closed
exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect('/');
  })
}


exports.getReset = (req, res, next) => {
  let message = req.flash('error');//req.flash ke array deta hai vid 17 validation
  if (message.length > 0) {
    message = message[0];
  }
  else {
    message = null;
  }
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'reset',
    errorMessage: message

  });
}
exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email })
      .then(user => {
        if (!user) {
          req.flash('error', 'No account with that email found.');
          return res.redirect('/reset');
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then(result => {
        res.redirect('/');
        return transporter.sendMail({
          to: req.body.email,
          from: 'riya.rashi141@gmail.com',
          subject: 'Password reset',
          html: `
              <p>You requested a password reset</p>
              <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
            `
        });
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);///next containing an error means it will skip all other middleware and directly handle the error
      });
  });


};
exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    //user find kro jiska token match kre plus wo expire bhi na hua ho ye hi check krna hoga
    .then(user => {
      let message = req.flash('error');//req.flash ke array deta hai vid 17 validation
      if (message.length > 0) {
        message = message[0];
      }
      else {
        message = null;
      }
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'reset password',
        errorMessage: message,
        userId: user._id.toString(),//we need that for post
        passwordToken: token
      });

    })
    .catch(err => {

      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);///next containing an error means it will skip all other middleware and directly handle the error
    });

}
exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;//vid6 adv authentication
  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId
  })
    .then(user => {
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then(hashedPassword => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;//no need of this fields so undefined
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then(result => {
      res.redirect('/login')
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);///next containing an error means it will skip all other middleware and directly handle the error
    })


}


