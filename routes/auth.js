const express = require('express');
const { check, body } = require('express-validator/check');
const authController = require('../controllers/auth');
const router = express.Router();
const User = require('../models/user');
router.get('/login', authController.getLogin);
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.'),
    body('password', 'Password has to be valid.')
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim()
  ],
  authController.postLogin
);
router.get('/signup', authController.getSignup);
router.post('/signup',
  [
    check('email')
      .isEmail()
      .withMessage('please enter a valid email')
      .custom((value, { req }) => {
        return User.findOne({ email: value })//to check if email registerd o not
          .then(userDoc => {
            if (userDoc) {
              return Promise.reject('email exists');
              // req.flash('error',' email exists');
              // return res.redirect('/signup');
            }
          });
      })
      .normalizeEmail(),//email small letter and removing white space//sanitizing data

    body('password', 'please enter a password with numbers and alphabets only and atleast 5 characters')
      .isLength({ min: 5 })
      .isAlphanumeric().isAlphanumeric()
      .trim(),
    body('confirmPassword')
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('password have to match!');
        }
        return true;
      })

  ]
  , authController.postSignup);
router.post('/logout', authController.postLogout);
router.get('/reset', authController.getReset);
router.post('/reset', authController.postReset);
router.get('/reset/:token', authController.getNewPassword)
router.post('/new-password', authController.postNewPassword)
module.exports = router; 