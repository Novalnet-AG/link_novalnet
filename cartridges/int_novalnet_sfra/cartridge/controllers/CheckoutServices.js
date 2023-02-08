/**
* Description of the Controller and the logic it provides
*
* @module  controllers/CheckoutServices
*/

'use strict';

var server = require('server');
var page = module.superModule;
server.extend(page);

server.prepend('PlaceOrder', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var collections = require('*/cartridge/scripts/util/collections');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
    var HookMgr = require('dw/system/HookMgr');
    var novalnetHelper = require('*/cartridge/scripts/novalnetHelper');
    var isNovalnetPayment = false;

    if (!currentBasket) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    collections.forEach(currentBasket.getPaymentInstruments(), function (paymentInstrument) {
        var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
        if (paymentProcessor.ID === 'NOVALNET') {
            isNovalnetPayment = true;
        }
    });

    if (isNovalnetPayment === false) {
        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });

        this.emit('route:Complete', req, res);
        return null;
    }

    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
    if (validationOrderStatus.error) {
        res.json({
            error: true,
            errorMessage: validationOrderStatus.message
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    // Check to make sure there is a shipping address
    if (currentBasket.defaultShipment.shippingAddress === null) {
        res.json({
            error: true,
            errorStage: {
                stage: 'shipping',
                step: 'address'
            },
            errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    // Check to make sure billing address exists
    if (!currentBasket.billingAddress) {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'billingAddress'
            },
            errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    // Re-validates existing payment instruments
    var validPayment = COHelpers.validatePayment(req, currentBasket);

    if (validPayment.error) {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'paymentInstrument'
            },
            errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    // Re-calculate the payments.
    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
    if (calculatedPaymentTransactionTotal.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    // Creates a new order.
    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    var handlePaymentResult = {};
    var authorizationResult = {};
    if (order.totalNetPrice !== 0) {
        var paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            handlePaymentResult.error = true;
        }
        if (!handlePaymentResult.error) {
            var paymentInstrument;
            for (var i = 0; i < paymentInstruments.length; i++) {
                paymentInstrument = paymentInstruments[i];
                var paymentProcessor = PaymentMgr
                    .getPaymentMethod(paymentInstrument.paymentMethod)
                    .paymentProcessor;
                authorizationResult = {};
                if (paymentProcessor === null) {
                    Transaction.begin();
                    paymentInstrument.paymentTransaction.setTransactionID(order.orderNo);
                    Transaction.commit();
                } else {
                    if (HookMgr.hasHook('app.payment.processor.' +
                                paymentProcessor.ID.toLowerCase())) {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                            'Authorize',
                            order,
                            paymentInstrument,
                            paymentProcessor
                        );
                    } else {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.default',
                            'Authorize'
                        );
                    }

                    if (authorizationResult.error) {
                        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                        handlePaymentResult.error = true;
                        break;
                    }
                }
            }
        }
    }

    if (handlePaymentResult.error) {
        var errorMessage = Resource.msg('error.technical', 'checkout', null);
        if (authorizationResult.novalnetPaymentResponse) {
            novalnetHelper.handleFailure(order, authorizationResult.novalnetPaymentResponse);
            errorMessage = authorizationResult.novalnetPaymentResponse.result.status_text;
        }
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'paymentInstrument'
            },
            errorMessage: errorMessage
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    var paymentResponse = authorizationResult.novalnetPaymentResponse;

    if (paymentResponse.result.redirect_url && paymentResponse.transaction.txn_secret) {
        var novalnetPaymentInstrument = novalnetHelper.getPaymentInstrument(order, paymentResponse.transaction.payment_type);
        Transaction.begin();
        Transaction.wrap(function () {
            novalnetPaymentInstrument.custom.novalnetTxnSecret = paymentResponse.transaction.txn_secret;
        });
        Transaction.commit();
        res.json({
            error: false,
            continueUrl: URLUtils.url(
                'Novalnet-Redirect',
                'redirectUrl',
                paymentResponse.result.redirect_url
            ).toString()
        });

        this.emit('route:Complete', req, res);
        return null;
    }


    novalnetHelper.handleSuccess(order, paymentResponse);


    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);

        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        this.emit('route:Complete', req, res);
        return null;
    }

    novalnetHelper.updateOrderStatus(order, paymentResponse.transaction.status, paymentResponse.transaction.payment_type);

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

    res.json({
        error: false,
        orderID: order.orderNo,
        orderToken: order.orderToken,
        continueUrl: URLUtils.url('Order-Confirm').toString()
    });
    this.emit('route:Complete', req, res);
    return null;
});

module.exports = server.exports();

