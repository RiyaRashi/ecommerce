require('dotenv').config();
const Product =require('../models/product');

const Order = require('../models/order');
const fs=require('fs');
const path=require('path');
const PDFDocument=require('pdfkit');

const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');
const transporter = nodemailer.createTransport(sendgridTransport({
  auth: {

    api_key:process.env.API_KEY
  }
}));
//sk_test_51HbixqGwPpdmM3feshMfkkthdWWc1rUHD4WYIV0caQgqbXjD8rG8kCcVPEAsD3dB60n9HXuH4uAETR0ibefgQ7D300Ud9HWltp
const stripe=require('stripe')(process.env.SECRET_KEY);

const ITEMS_PER_PAGE=2;
exports.getIndex = (req, res, next) => {
    Product.find()
    .then(products => {
        res.render('shop/index', {
          prods: products,
          pageTitle: 'Shop',
          path: '/'
        });
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  };


exports.getProducts=(req,res,next)=>{
  const page=+req.query.page || 1;//converting to int we need += and ||1 becos we need this when we are at product page
  let totalItems;
 Product.find().countDocuments().then(numProducts=>{
   totalItems=numProducts;
   return   Product.find().skip((page-1)*ITEMS_PER_PAGE) ///page-1 taki pichle pages ke item skip ho jai
   .limit(ITEMS_PER_PAGE)
  })
  .then(products=>{
        res.render('shop/myshop',{
            pageTitle:'myshop',
            path:'/products',
            prods:products,
            currentPage:page,
            hasNextPage:ITEMS_PER_PAGE*page<totalItems,
            hasPreviousPage:page>1,
            nextPage:page+1,
            previousPage:page-1,
            lastPage: Math.ceil(totalItems/ITEMS_PER_PAGE)
            //   isAuthenticated:req.session.isLoggedIn
            //hasProducts:products.length>0,
        });
    })
    .catch(err=>{
        const error=new Error(err);
        error.httpStatusCode=500;
        return next(error);///next containing an error means it will skip all other middleware and directly handle the error
    });
}


exports.getProductDetail=(req,res,next)=>{
const prodId=req.params.productId;
Product.findById(prodId)
.then(product=>{
    res.render('shop/product-detail',{
        product:product,
        pageTitle:product.title,
        path:'/products',
        //isAuthenticated:req.session.isLoggedIn
    });
})
.catch(err=>{
    const error=new Error(err);
    error.httpStatusCode=500;
    return next(error);///next containing an error means it will skip all other middleware and directly handle the error
});
}
exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart=(req,res,next)=>{
    const prodId=req.body.productId;
    Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    })
    .catch(err=>{
      console.log(err);
        
    })
    ;
}
exports.postCartDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    req.user
      .removeFromCart(prodId)
      .then(result => {
        res.redirect('/cart');
      })
      .catch(err => {
        const error=new Error(err);
        error.httpStatusCode=500;
        return next(error);///next containing an error means it will skip all other middleware and directly handle the error
      });
  };
  exports.getCheckout=(req,res,next)=>{
    let products;
    let total=0;
    req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
       products = user.cart.items;
       total=0;
  products.forEach(p=>{
  total+=p.quantity*p.productId.price;//total calc 
  });
  
  return stripe.checkout.sessions.create({
  payment_method_types:['card'],
  billing_address_collection:'required',
  shipping_address_collection: {
    allowed_countries: ['IN', 'US'],
  },
    mode:'payment',

  line_items: products.map(p => {
    return {
      name: p.productId.title,
      description: p.productId.description,
      amount: p.productId.price*100 ,
      currency: 'INR',
      quantity: p.quantity
    };
  }),
    success_url: req.protocol + '://' + req.get('host') + '/checkout/success', // => http://localhost:3000
    cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
  
  });
    })
      .then(session=>{
        res.render('shop/checkout', {
          path: '/checkout',
          pageTitle: 'checkout',
          products: products,
          totalSum:total,
          sessionId:session.id
      });
    
      
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
  
  }
  exports.getCheckoutSuccess = (req, res, next) => {
    req.user
      .populate('cart.items.productId')
      .execPopulate()
      .then(user => {
        const products = user.cart.items.map(i => {
          return { quantity: i.quantity, product: { ...i.productId._doc } };
        });
        const order = new Order({
          user: {
            email: req.user.email,
            userId: req.user
          },
          products: products
        });
        return order.save();
      })
      .then(result => {
        return req.user.clearCart();
      })
      .then(() => {

        res.redirect('/orders');
        return transporter.sendMail({
          to: req.user.email,
          from: 'riya.rashi141@gmail.com',
          subject: 'Payment receipt',
          html: '<h1> Successsfully payment done </h1> You can go to my orders and download the invoice '
        });
      
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  };

exports.postOrder=(req,res,next)=>{
    req.user
    .populate('cart.items.productId')
    .execPopulate()///poplate ke badd promise ni leta hai isliey execpopulate
        .then(user=>{
            console.log(user.cart.items);
const products=user.cart.items.map(i=>{
    return{quantity:i.quantity,product:{...i.productId._doc}};
});
const order=new Order({
    user:{
        email:req.user.email,
        userId:req.user
    },
    products:products
});
return order.save();
})
.then(result=>{
   return  req.user.clearCart();
  
})
.then(()=>{
    
res.redirect('/orders');

})
.catch(err=>
    {
        const error=new Error(err);
        error.httpStatusCode=500;
        return next(error);///next containing an error means it will skip all other middleware and directly handle the error
    });
};

exports.getOrders = (req, res, next) => {
    Order.find({ 'user.userId': req.user._id })
      .then(orders => {
        res.render('shop/orders', {
          path: '/orders',
          pageTitle: 'Your Orders',
          orders: orders,
          //isAuthenticated:req.session.isLoggedIn
        });
      })
      .catch(err => {
        const error=new Error(err);
        error.httpStatusCode=500;
        return next(error);///next containing an error means it will skip all other middleware and directly handle the error
      });
  };

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);
  
const pdfDoc= new PDFDocument();
res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="' + invoiceName + '"'
        );
pdfDoc.pipe(fs.createWriteStream(invoicePath));
pdfDoc.pipe(res);

pdfDoc.fontSize(22).text('Invoice',{
  underline:true,
  align:'center'
});
pdfDoc.text('--------------------',{
  align:'center'
}); 
let totalPrice=0;
order.products.forEach(prod=>{
  totalPrice+=prod.quantity*prod.product.price;
  pdfDoc.fontSize(14).text(prod.product.title+'-'+prod.quantity+'*'+'Rs.'+ prod.product.price,{
    align:'center'
  });
});
pdfDoc.text('--------------------',{
  align:'center'
});
pdfDoc.fontSize(20).text('Total Price :Rs.'+totalPrice,{
  align:'center'
});
pdfDoc.end();
        })
     .catch(err => next(err));
};