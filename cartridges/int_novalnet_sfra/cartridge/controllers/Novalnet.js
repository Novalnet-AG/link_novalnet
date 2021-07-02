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
server.get('Redirect', function (req, res, next) {
    var redirectUrl = decodeURIComponent(req.querystring.redirectUrl);
    res.redirect(redirectUrl);
    return next();
});

server.get('RemovePaymentToken', function (req, res, next) {
    var orderNo = decodeURIComponent(req.querystring.orderNo);
    var orderToken = decodeURIComponent(req.querystring.orderToken);
    var result = { success: false };

    if (orderNo) {
        var order = OrderMgr.getOrder(orderNo, orderToken);
        Transaction.begin();
        Transaction.wrap(function () {
            order.custom.novalnetPaymentToken = null;
        });
        Transaction.commit();
        result = { success: true };
    }

    res.json(result);
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

    var paymentInstrument = novalnetHelper.getPaymentInstrument(order, paymentType);
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
            order.addNote('Novalnet Transaction Details', comment);
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

    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.
    res.redirect(URLUtils.url('Order-Confirm', 'ID', order.orderNo, 'token', order.orderToken));

    return next();
});

module.exports = server.exports();

