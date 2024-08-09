/**
* Description of the Controller and the logic it provides
*
* @module  controllers/novalnet
*/

'use strict';

var server = require('server');
var Transaction = require('dw/system/Transaction');
var novalnetHelper = require('*/cartridge/scripts/novalnetHelper');
var novalnetService = require('*/cartridge/scripts/novalnetService');
var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');
var OrderMgr = require('dw/order/OrderMgr');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');
var crypto = require('dw/crypto');

/**
 * Redirects to Novalnet payment page
 */
server.post('Redirect', server.middleware.https, function (req, res, next) {
    var redirectUrl = req.querystring.redirectUrl;
    res.redirect(redirectUrl);
    return next();
});

/**
 * Redirects to Novalnet payment page
 */
server.get('getPaymentFormUrl', function (req, res, next) {
	var BasketMgr = require('dw/order/BasketMgr');
	var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');
	
	var bFirstName = decodeURIComponent(req.querystring.firstName);
    var bLastName = decodeURIComponent(req.querystring.lastName);
    var bEmail = decodeURIComponent(req.querystring.email);
    var bStreet = decodeURIComponent(req.querystring.street);
    var bCity = decodeURIComponent(req.querystring.city);
    var bZip = decodeURIComponent(req.querystring.zip);
    var bCountryCode = decodeURIComponent(req.querystring.countryCode);
    var bState = decodeURIComponent(req.querystring.state);
	
	var basket = BasketMgr.getCurrentBasket();
	
	var shippingAddress = basket.getDefaultShipment().getShippingAddress();
	
	var shippingStreet = shippingAddress.getAddress1();
    if (shippingAddress.getAddress2()) {
        shippingStreet += shippingAddress.getAddress2();
    }

    var customer = {
        first_name: bFirstName,
        last_name: bLastName,
        email: basket.getCustomerEmail(),
        customer_ip: request.getHttpRemoteAddress(),
        customer_no: basket.getCustomerNo() ? basket.getCustomerNo() : 'guest',
        gender: 'u',
        billing: {
            street: bStreet,
            city: bCity,
            zip: bZip,
            country_code: bCountryCode
        }
    };
    
    if(!empty(bState)) {
		customer.billing.state = bState;
	}
    
	customer.shipping = {
		street: shippingStreet,
		city: shippingAddress.getCity(),
		zip: shippingAddress.getPostalCode(),
		country_code: shippingAddress.getCountryCode().value
	};
	
	if(!empty(shippingAddress.getStateCode())) {
		customer.shipping.state = shippingAddress.getStateCode();
	}
	
	if(JSON.stringify(customer.shipping) === JSON.stringify(customer.billing)) {
		customer.shipping = {
			same_as_billing : 1
		};
	}
	else {
		customer.shipping.first_name = shippingAddress.getFirstName();
		customer.shipping.last_name = shippingAddress.getLastName();
		customer.shipping.email = basket.getCustomerEmail();
		
		if (shippingAddress.getPhone()) {
			customer.shipping.tel = shippingAddress.getPhone();
		}
	}	
	
	var transactionParams = {
	  currency: basket.getCurrencyCode(),
	  amount: Math.round(basket.totalGrossPrice * 100),
	  system_name: 'salesforce-commerce-cloud',
	  system_version: novalnetHelper.getSystemVersion(),
	};
	
	var hostedPageParams = {
	  type : 'PAYMENTFORM',
	};
	
	var customParams = {
	  lang: novalnetConfig.getCurrentLang()
	};
	
	var merchantData = {
		signature: novalnetConfig.getProductActivationKey(),
        tariff: novalnetConfig.getTariffId()	
	};
		
	var request_params = {'merchant': merchantData, 'customer': customer, 'transaction': transactionParams, 'hosted_page': hostedPageParams, 'custom' : customParams};
	var request_data = JSON.stringify(request_params);
    
    var callResult = novalnetService.getNovalnetService('https://payport.novalnet.de/v2/seamless/payment').call(request_data);
    
	if (callResult.isOk() === false) {
        novalnetHelper.debugLog(callResult.getErrorMessage());
        return JSON.stringify({error: true, statusText: callResult.getErrorMessage()});
    }

    var resultObject = novalnetHelper.getFormattedResult(callResult.object);
  
    res.json(resultObject);
    return next();
});

/**
 * Handle the response from novalnet server
 */
server.get('HandleResponse', server.middleware.https, function (req, res, next) {
    var tid = decodeURIComponent(req.querystring.tid).toString();
    var orderNo = decodeURIComponent(req.querystring.orderNo);
    var orderToken = decodeURIComponent(req.querystring.orderToken);
    var paymentType = decodeURIComponent(req.querystring.payment_type);
    var statusText = decodeURIComponent(req.querystring.status_text);

    var order = OrderMgr.getOrder(orderNo, orderToken);

    var paymentInstrument = novalnetHelper.getPaymentInstrument(order);
    var storedTxnSecret = paymentInstrument.custom.novalnetTxnSecret;
    var txnSecret = storedTxnSecret || decodeURIComponent(req.querystring.txn_secret);

    Transaction.begin();
    Transaction.wrap(function () {
        paymentInstrument.custom.novalnetTxnSecret = '';
    });
    Transaction.commit();

    if (!tid || tid === 'undefined') {
        Transaction.begin();
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        order.addNote('Novalnet Transaction Details', statusText);
        Transaction.commit();
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'novalnetPaymentError', statusText));
        return next();
    }

    var status = decodeURIComponent(req.querystring.status);
    var checksum = decodeURIComponent(req.querystring.checksum);
    var apiKey = novalnetConfig.getPaymentAccessKey();

    if (typeof status !== 'undefined' && typeof checksum !== 'undefined' && typeof txnSecret !== 'undefined' && apiKey) {
        apiKey = apiKey.split('').reverse().join('');
        var tokenString = tid + txnSecret + status + apiKey;
        var hash = crypto.MessageDigest('SHA-256');
        var genChecksum = hash.digest(tokenString);

        if (genChecksum !== checksum) {
            Transaction.begin();
            Transaction.wrap(function () {
                OrderMgr.failOrder(order, true);
            });
            var comment = Resource.msg('novalnet.hashcheckfailed', 'novalnet', null);
            order.addNote(Resource.msg('novalnet.transaction_details', 'novalnet', null), comment);
            Transaction.commit();
            res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'novalnetPaymentError', comment));
            return next();
        }
    }

    var lang = novalnetConfig.getCurrentLang();
    var data = {
        transaction: {
            tid: tid
        },
        custom: {
            lang: lang
        }
    };

    var callResult = novalnetService.getNovalnetService('https://payport.novalnet.de/v2/transaction/details').call(JSON.stringify(data));
    if (callResult.isOk() === false) {
        novalnetHelper.debugLog(callResult.getErrorMessage());
        var errorMsg = callResult.getErrorMessage().toString();
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'novalnetPaymentError', errorMsg));
        return next();
    }

    var transactionDetails = JSON.parse(callResult.object);

    transactionDetails.transaction.tid = tid;

    if (['FAILURE', 'DEACTIVATED'].indexOf(transactionDetails.transaction.status) > -1 || transactionDetails.result.status === 'FAILURE') {
        Transaction.begin();
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        Transaction.commit();
        novalnetHelper.handleFailure(order, transactionDetails);
        statusText = (typeof statusText !== 'undefined') ? statusText : transactionDetails.result.status_text;
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'novalnetPaymentError', statusText));
        return next();
    }

    novalnetHelper.handleSuccess(order, transactionDetails);
    // custom fraudDetection
    const fraudDetectionStatus = { status: 'success' };

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        Transaction.begin();
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        Transaction.commit();
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'novalnetPaymentError', Resource.msg('error.technical', 'checkout', null)));
        return next();
    }

    novalnetHelper.updateOrderStatus(order, transactionDetails.transaction.status, transactionDetails.transaction.payment_type);

    if (req.currentCustomer.addressBook) {
        // save all used shipping addresses to address book of the logged in customer
        var allAddresses = addressHelpers.gatherShippingAddresses(order);
        allAddresses.forEach(function (address) {
            if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
            }
        });
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, req.locale.id);
    }

    // Reset usingMultiShip after successful Order placement
    req.session.privacyCache.set('usingMultiShipping', false);
	
	res.render('checkout/novalnetCompleteOrder', {
	  orderNo : order.orderNo,
	  orderToken: order.orderToken,
      continueURL: URLUtils.url('Order-Confirm')
    });
    
    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.

    return next();
});

module.exports = server.exports();

