/* eslint-disable no-continue, no-nested-ternary, radix */

'use strict';

var URLUtils = require('dw/web/URLUtils');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');
var Resource = require('dw/web/Resource');

/**
 * Creates a Payment Request object
 * @param {dw.order} order - order
 * @param {dw.order.paymentInstrument} paymentInstrument - paymentInstrument
 * @returns {Object} - The created payment request object.
 */
exports.getPaymentRequestObject = function (order, paymentInstrument) {
    var data = {};

    data.merchant = getMerchantDetails();
    data.customer = getCustomerDetails(order, paymentInstrument);
    data.transaction = getTransactionDetails(order, paymentInstrument);

    var paymentType = getNovalnetPaymentType(paymentInstrument);

    if (['INSTALMENT_DIRECT_DEBIT_SEPA', 'INSTALMENT_INVOICE'].indexOf(paymentType) > -1) {
        data.instalment = {
            interval: '1m',
            cycles: paymentInstrument.custom.novalnetInstalmentCycle
        };
    }
    
    if(paymentType == 'PAYPAL') {
		data.cart_info = getCartDetails(order);
	}

    data.custom = {
        lang: novalnetConfig.getCurrentLang(),
        input1: 'orderToken',
        inputval1: order.orderToken
    };

    return data;
};

/**
 * creates a cart details object
 * @param {dw.order} order - order
 *
 * @returns {Object} - The created object.
 */
function getCartDetails(order) {
   var cartInfo = {};
    var cartLineItems = [];
    // iterate all product line items of the basket and set prices
    var productLineItems = order.getAllProductLineItems().iterator();
    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();
		var productAmount = (productLineItem.getAdjustedNetPrice().getValue() / productLineItem.getQuantityValue());
		var cartLineItem = {
			name: productLineItem.getProductName(),
			price: Math.round(productAmount * 100),
			quantity: productLineItem.getQuantityValue(),
		};
		cartLineItems.push(cartLineItem);
	}
	cartInfo.items_tax_price = Math.round(order.getTotalTax().getValue() * 100);
	cartInfo.items_shipping_price = Math.round(order.getShippingTotalNetPrice().getValue() * 100);
	cartInfo.line_items = cartLineItems;
	return cartInfo;
}

/**
 * creates a merchant details object
 *
 * @returns {Object} - The created object.
 */
function getMerchantDetails() {
    var merchantData = {
        signature: novalnetConfig.getProductActivationKey(),
        tariff: novalnetConfig.getTariffId()
    };
    return merchantData;
}

/**
 * creates a customer details object
 * @param {dw.order} order - order
 * @param {dw.order.paymentInstrument} paymentInstrument - paymentInstrument
 *
 * @returns {Object} - The created object.
 */
function getCustomerDetails(order, paymentInstrument) {
    var paymentType = getNovalnetPaymentType(paymentInstrument);
    var billingAddress = order.getBillingAddress();
    var shippingAddress = order.getDefaultShipment().getShippingAddress();

    var billingStreet = billingAddress.getAddress1();
    if (billingAddress.getAddress2()) {
        billingStreet += billingAddress.getAddress2();
    }

    var shippingStreet = shippingAddress.getAddress1();
    if (shippingAddress.getAddress2()) {
        shippingStreet += shippingAddress.getAddress2();
    }

    var customer = {
        first_name: billingAddress.getFirstName(),
        last_name: billingAddress.getLastName(),
        email: order.getCustomerEmail(),
        customer_ip: request.getHttpRemoteAddress(),
        customer_no: order.getCustomerNo() ? order.getCustomerNo() : 'guest',
        gender: 'u',
        billing: {
            street: billingStreet,
            city: billingAddress.getCity(),
            zip: billingAddress.getPostalCode(),
            country_code: billingAddress.getCountryCode().value
        }
    };
    
    if(!empty(billingAddress.getStateCode())) {
		customer.billing.state = billingAddress.getStateCode();
	}

    if (billingAddress.isEquivalentAddress(shippingAddress)) {
        customer.shipping = {
            same_as_billing: 1
        };
    } else {
        customer.shipping = {
            first_name: shippingAddress.getFirstName(),
            last_name: shippingAddress.getLastName(),
            email: order.getCustomerEmail(),
            street: shippingStreet,
            city: shippingAddress.getCity(),
            zip: shippingAddress.getPostalCode(),
            country_code: shippingAddress.getCountryCode().value
        };
        if (shippingAddress.getPhone()) {
            customer.shipping.tel = shippingAddress.getPhone();
        }
        if(!empty(shippingAddress.getStateCode())) {
			customer.shipping.state = shippingAddress.getStateCode();
		}
    }
    if (billingAddress.getPhone()) {
        customer.billing.tel = billingAddress.getPhone();
    }

    if (['GUARANTEED_INVOICE', 'GUARANTEED_DIRECT_DEBIT_SEPA', 'INSTALMENT_DIRECT_DEBIT_SEPA', 'INSTALMENT_INVOICE'].indexOf(paymentType) > -1) {
        var birth_date = paymentInstrument.custom.novalnetCustomerDob.split('.');
        birth_date = birth_date[2] + '-' + birth_date[1] + '-' + birth_date[0];
        customer.birth_date = birth_date;
    }
    return customer;
}

/**
 * creates a transaction details object
 * @param {dw.order} order - the order object
 * @param {dw.order.paymentInstrument} paymentInstrument - paymentInstrument
 *
 * @returns {Object} - The created object.
 */
function getTransactionDetails(order, paymentInstrument) {
    var amount = Math.round(paymentInstrument.paymentTransaction.amount.value * 100);
    var paymentMethodId = PaymentMgr
        .getPaymentMethod(paymentInstrument.paymentMethod).ID;
    var config = novalnetConfig.getPaymentConfiguration(paymentMethodId);

    var paymentType = getNovalnetPaymentType(paymentInstrument);

    var transaction = {
        payment_type: paymentType,
        amount: amount,
        currency: order.getCurrencyCode(),
        test_mode: config.testMode,
        order_no: order.orderNo,
        system_name: 'salesforce-commerce-cloud'
    };

    if (['INVOICE', 'PREPAYMENT', 'DIRECT_DEBIT_SEPA', 'CASHPAYMENT'].indexOf(paymentType) > -1) {
        if (config.dueDate) {
            var date = new Date();
            date.setDate(date.getDate() + config.dueDate);
            var year = date.getFullYear().toString();
            var month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
            var day = date.getDate().toString();
            transaction.due_date = year + '-' + (month[1] ? month : '0' + month[0]) + '-' + (day[1] ? day : '0' + day[0]);
        }
    }
    
    if (['DIRECT_DEBIT_SEPA', 'CREDITCARD'].indexOf(paymentType) > -1) {
		if(config.zeroAmountBooking === true) {
			transaction.amount = 0;
			transaction.create_token = 1;
		}
	}

    var isRefTransaction = false;
    if (['DIRECT_DEBIT_SEPA', 'GUARANTEED_DIRECT_DEBIT_SEPA', 'INSTALMENT_DIRECT_DEBIT_SEPA', 'CREDITCARD'].indexOf(paymentType) > -1) {
        if (paymentInstrument.custom.novalnetSavedToken) {
            transaction.payment_data = { token: paymentInstrument.custom.novalnetSavedToken };
            isRefTransaction = true;
        } else {
            if (paymentInstrument.custom.novalnetSavePaymentData === true) {
                transaction.create_token = 1;
            }
            if (paymentType === 'CREDITCARD') {
                transaction.payment_data = {
                    pan_hash: paymentInstrument.custom.novalnetPanHash,
                    unique_id: paymentInstrument.custom.novalnetUniqueId
                };
                if (session.privacy.novalnetCCDoRedirect == 1 && config.enforce3d === true) {
                    transaction.payment_data.enforce_3d = 1;
                }
            } else if (['DIRECT_DEBIT_SEPA', 'GUARANTEED_DIRECT_DEBIT_SEPA', 'INSTALMENT_DIRECT_DEBIT_SEPA'].indexOf(paymentType) > -1) {
                transaction.payment_data = {
                    iban: paymentInstrument.custom.novalnetSepaIban
                };
                if(!empty(session.privacy.novalnetSepaBic)) {
					transaction.payment_data.bic = session.privacy.novalnetSepaBic;
				}
            }
        }
    }


    if (((['IDEAL', 'ONLINE_TRANSFER', 'GIROPAY', 'EPS', 'PRZELEWY24', 'PAYPAL', 'BANCONTACT', 'POSTFINANCE', 'POSTFINANCE_CARD'].indexOf(paymentType) > -1) || (paymentType === 'CREDITCARD' && session.privacy.novalnetCCDoRedirect == 1)) && !isRefTransaction) {
        transaction.return_url = URLUtils.https('Novalnet-HandleResponse', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString();
        transaction.error_return_url = URLUtils.https('Novalnet-HandleResponse', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString();
    }

    return transaction;
}

/**
 * Get Novalnet Payment Type
 * @param {dw.order.paymentInstrument} paymentInstrument -  paymentInstrument
 * @returns {string} - Novalnet Payment Type.
 */
function getNovalnetPaymentType(paymentInstrument) {
    var paymentMethodId = PaymentMgr
        .getPaymentMethod(paymentInstrument.paymentMethod).ID;
    var name = paymentMethodId.toLowerCase();
    var novalnetpaymentType = {
        novalnet_invoice: 'INVOICE',
        novalnet_ideal: 'IDEAL',
        novalnet_prepayment: 'PREPAYMENT',
        novalnet_sepa: 'DIRECT_DEBIT_SEPA',
        novalnet_creditcard: 'CREDITCARD',
        novalnet_sofort: 'ONLINE_TRANSFER',
        novalnet_giropay: 'GIROPAY',
        novalnet_eps: 'EPS',
        novalnet_przelewy: 'PRZELEWY24',
        novalnet_paypal: 'PAYPAL',
        novalnet_cashpayment: 'CASHPAYMENT',
        novalnet_multibanco: 'MULTIBANCO',
        novalnet_bancontact: 'BANCONTACT',
        novalnet_postfinance: 'POSTFINANCE',
        novalnet_postfinance_card: 'POSTFINANCE_CARD',
        novalnet_guaranteed_invoice: 'GUARANTEED_INVOICE',
        novalnet_guaranteed_sepa: 'GUARANTEED_DIRECT_DEBIT_SEPA',
        novalnet_instalment_sepa: 'INSTALMENT_DIRECT_DEBIT_SEPA',
        novalnet_instalment_invoice: 'INSTALMENT_INVOICE'
    };
    return novalnetpaymentType[name];
}

/**
 * Get Shop Payment ID
 * @param {string} paymentType - novalnet payment type
 * @returns {string} - Shop Payment ID.
 */
function getShopPaymentId(paymentType) {
    var name = paymentType.toLowerCase();
    var paymentId = {
        invoice: 'novalnet_invoice',
        ideal: 'novalnet_ideal',
        prepayment: 'novalnet_prepayment',
        direct_debit_sepa: 'novalnet_sepa',
        creditcard: 'novalnet_creditcard',
        online_transfer: 'novalnet_sofort',
        giropay: 'novalnet_giropay',
        eps: 'novalnet_eps',
        przelewy24: 'novalnet_przelewy',
        paypal: 'novalnet_paypal',
        cashpayment: 'novalnet_cashpayment',
        multibanco: 'novalnet_multibanco',
        bancontact: 'novalnet_bancontact',
        postfinance: 'novalnet_postfinance',
        postfinance_card: 'novalnet_postfinance_card',
        guaranteed_invoice: 'novalnet_guaranteed_invoice',
        guaranteed_direct_debit_sepa: 'novalnet_guaranteed_sepa',
        instalment_direct_debit_sepa: 'novalnet_instalment_sepa',
        instalment_invoice: 'novalnet_instalment_invoice'
    };
    return paymentId[name].toUpperCase();
}


/**
 * Update order status
 * @param {dw.order} order - order
 * @param {string} status - novalnet transaction status
 * @param {string} paymentType - paymentType
 * @returns {null}.
 */
exports.updateOrderStatus = function (order, status, paymentType) {
    var orderStatus = order.ORDER_STATUS_OPEN;
    var paymentStatus = order.PAYMENT_STATUS_NOTPAID;
    var orderconfimationStatus = order.CONFIRMATION_STATUS_CONFIRMED;
    var exportStatus = order.EXPORT_STATUS_NOTEXPORTED;

    if (status === 'CONFIRMED' && paymentType !== 'INVOICE') {
        orderStatus = order.ORDER_STATUS_COMPLETED;
        paymentStatus = order.PAYMENT_STATUS_PAID;
        exportStatus = order.EXPORT_STATUS_READY;
    } else if (status === 'ON_HOLD') {
        orderconfimationStatus = order.CONFIRMATION_STATUS_NOTCONFIRMED;
    } else if (['DEACTIVATED', 'FAILURE'].indexOf(status) > -1) {
        orderStatus = order.ORDER_STATUS_CANCELLED;
    }

    try {
        Transaction.begin();
        Transaction.wrap(function () {
            order.setStatus(orderStatus);
            order.setPaymentStatus(paymentStatus);
            order.setConfirmationStatus(orderconfimationStatus);
            order.setExportStatus(exportStatus);
        });
        Transaction.commit();
    } catch (e) {
        return false;
    }
};

/**
 * Add order note
 * @param {dw.order} order - order
 * @param {string} comment - payment comment
 * @param {boolean} append - append to order comment
 */
function addOrderNote(order, comment, append) {
    var novalnetPaymentComment = order.custom.novalnetPaymentComment;
    if (append) {
        novalnetPaymentComment += comment;
    } else {
        novalnetPaymentComment = comment;
    }

    Transaction.begin();
    Transaction.wrap(function () {
        order.addNote('Novalnet Transaction Details', comment);
        order.custom.novalnetPaymentComment = novalnetPaymentComment;
    });
    Transaction.commit();
}

/**
 * Creates a novalnet payment comments
 * @param {Object} paymentResponse - paymentResponse
 * @param {boolean} isSuccess - success transaction
 * @returns {string} comment - created comment.
 */
function formComments(paymentResponse, isSuccess) {
    var newLine = '\n';
    var comment = '';
    var tid = paymentResponse.transaction ? (paymentResponse.transaction.tid ? paymentResponse.transaction.tid.toString() : null) : null;
    var test_mode = paymentResponse.transaction ? paymentResponse.transaction.test_mode : null;

    if (tid) {
        comment += Resource.msgf('novalnet.transactionid', 'novalnet', null, tid);
        comment += newLine;
    }
    if (test_mode === 1) {
        comment += Resource.msg('novalnet.testorder', 'novalnet', null) + newLine;
    }
    if (!isSuccess) {
        comment += paymentResponse.result.status_text;
        return comment;
    }

    comment += getPaymentComments(paymentResponse);
    return comment;
}

/**
 * Creates a novalnet payment comments
 * @param {Object} paymentResponse - paymentResponse
 * @returns {string} - created comment.
 */
function getPaymentComments(paymentResponse) {
    var paymentType = paymentResponse.transaction.payment_type;
    var status = paymentResponse.transaction.status;
    var tid = paymentResponse.transaction.tid;

    var amount = paymentResponse.instalment ? paymentResponse.instalment.cycle_amount : paymentResponse.transaction.amount;

    var formattedAmount = getFormattedAmount(amount, paymentResponse.transaction.currency);

    var comment = '';
    var newLine = '\n';

    if (['GUARANTEED_INVOICE', 'INSTALMENT_INVOICE', 'GUARANTEED_DIRECT_DEBIT_SEPA', 'INSTALMENT_DIRECT_DEBIT_SEPA'].indexOf(paymentType) > -1 && status === 'PENDING') {
        comment += Resource.msg('novalnet.guarantee.pending', 'novalnet', null);
    } else if (paymentResponse.transaction.bank_details) {
        comment = Resource.msgf('novalnet.invoice.amount.transfer', 'novalnet', null, formattedAmount) + newLine;
        if (status !== 'ON_HOLD' && paymentResponse.transaction.due_date) {
            comment = Resource.msgf('novalnet.invoice.amount.transfer.duedate', 'novalnet', null, formattedAmount, paymentResponse.transaction.due_date) + newLine;
        }

        comment += Resource.msg('novalnet.invoice.accountholder', 'novalnet', null) + ' ' + paymentResponse.transaction.bank_details.account_holder + newLine;
        comment += 'BANK: ' + paymentResponse.transaction.bank_details.bank_name + newLine;
        comment += Resource.msg('novalnet.invoice.place', 'novalnet', null) + ' ' + paymentResponse.transaction.bank_details.bank_place + newLine;
        comment += 'IBAN: ' + paymentResponse.transaction.bank_details.iban + newLine;
        comment += 'BIC: ' + paymentResponse.transaction.bank_details.bic + newLine;
        comment += Resource.msg('novalnet.invoice.reference', 'novalnet', null) + newLine;

        if (paymentType === 'INSTALMENT_INVOICE') {
            comment += Resource.msg('novalnet.invoice.paymentreference', 'novalnet', null) + ': ' + tid + newLine;
        } else {
            comment += Resource.msg('novalnet.invoice.paymentreference', 'novalnet', null) + ' 1: ' + tid + newLine;
            comment += Resource.msg('novalnet.invoice.paymentreference', 'novalnet', null) + ' 2: ' + paymentResponse.transaction.invoice_ref + newLine;
        }
    } else if (paymentType === 'CASHPAYMENT') {
        comment += Resource.msgf('novalnet.cashpayment.slipexiprydate', 'novalnet', null, paymentResponse.transaction.due_date) + newLine;
        comment += Resource.msg('novalnet.cashpayment.stores', 'novalnet', null) + newLine;
        var nearestStores = paymentResponse.transaction.nearest_stores;
        for (var key in nearestStores) { // eslint-disable-line guard-for-in
            var storeDetails = nearestStores[key];
            comment += storeDetails.store_name + newLine;
            comment += storeDetails.street + newLine;
            comment += storeDetails.city + newLine;
            comment += storeDetails.zip + newLine;
            comment += storeDetails.country_code + newLine + newLine;
        }
    } else if (paymentType === 'MULTIBANCO') {
        comment += Resource.msgf('novalnet.multibanco.reference', 'novalnet', null, formattedAmount) + newLine;
        comment += Resource.msgf('novalnet.multibanco.paymentreference', 'novalnet', null, paymentResponse.transaction.partner_payment_reference) + newLine;
        comment += Resource.msgf('novalnet.multibanco.entity', 'novalnet', null, paymentResponse.transaction.service_supplier_id) + newLine;
    }

    return comment;
}

/**
 * retrieves payment instrumen
 * @param {dw.order.Order} order - order
 * @param {string} paymentType - payment type
 * @returns {Object} paymentInstrument- payment instrument
 */
function getPaymentInstrument(order, paymentType) {
    var paymentId = getShopPaymentId(paymentType);
    for (var i = 0; i < order.paymentInstruments.length; i += 1) {
        var paymentInstrument = order.paymentInstruments[i];

        if (paymentInstrument.paymentMethod.equals(paymentId)) {
            return paymentInstrument;
        }
    }
}

/**
 * handle response from novalnet for successful transaction
 * @param {dw.order.Order} order - order
 * @param {Object} paymentResponse - response from novalnet
 * @returns {void}
 */
exports.handleSuccess = function (order, paymentResponse) {
    saveTransactionDetails(order, paymentResponse);
    var comment = formComments(paymentResponse, true);
    if(order.custom.novalnetZeroAmountBooking == true) {
		comment += "\n " + Resource.msg('novalnet.zero_amount_booking_info', 'novalnet', null);
	}
    addOrderNote(order, comment, false);
    return null;
};

/**
 * handle response from novalnet for failure transaction
 * @param {dw.order.Order} order - order
 * @param {Object} paymentResponse - response from novalnet
 */
exports.handleFailure = function (order, paymentResponse) {
    var tid = paymentResponse.transaction ? (paymentResponse.transaction.tid ? paymentResponse.transaction.tid : null) : null;
    if (tid) {
        saveTransactionDetails(order, paymentResponse);
    }
    var comment = formComments(paymentResponse, false);
    addOrderNote(order, comment, false);
};

/**
 * saves novalnet transaction details
 * @param {dw.order.Order} order - order
 * @param {Object} paymentResponse - novalnet response
 * @returns {void}
 */
function saveTransactionDetails(order, paymentResponse) {
    var paymentInstrument = getPaymentInstrument(order, paymentResponse.transaction.payment_type);
    var tid = paymentResponse.transaction.tid.toString();
    var paidAmount = 0;
    
    var paymentMethodId = PaymentMgr
        .getPaymentMethod(paymentInstrument.paymentMethod).ID;
    var config = novalnetConfig.getPaymentConfiguration(paymentMethodId);
    
    if (!(['INVOICE', 'GUARANTEED_INVOICE', 'INSTALMENT_INVOICE', 'PREPAYMENT', 'CASHPAYMENT', 'MULTIBANCO'].indexOf(paymentResponse.transaction.payment_type) > -1) && paymentResponse.transaction.status === 'CONFIRMED') {
        paidAmount = paymentResponse.transaction.amount;
    }

    Transaction.begin();
    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.transactionID = tid;
        order.custom.novalnetTid = tid;
        order.custom.novalnetPaidAmount = paidAmount;
        order.custom.novalnetOrderAmount = paymentResponse.transaction.amount;
        order.custom.novalnetPaymentStatus = paymentResponse.transaction.status;
        order.custom.novalnetPaymentMethod = paymentResponse.transaction.payment_type;

        if (order.custom.novalnetSavePaymentData === true && paymentResponse.transaction.payment_data.token) {
            order.custom.novalnetPaymentToken = paymentResponse.transaction.payment_data.token;
        }
        
        if(['CREDITCARD', 'DIRECT_DEBIT_SEPA'].indexOf(paymentResponse.transaction.payment_type) > -1) {
			if(paymentResponse.transaction.amount === 0 && config.zeroAmountBooking === true && paymentResponse.transaction.payment_data.token) {
				order.custom.novalnetZeroAmountBooking = true;
				order.custom.novalnetPaymentToken = paymentResponse.transaction.payment_data.token;
			}
		}

        if (paymentResponse.instalment && paymentResponse.transaction.status === 'CONFIRMED') {
            var formattedAmount = getFormattedAmount(paymentResponse.instalment.cycle_amount, paymentResponse.transaction.currency);
            paymentResponse.instalment[paymentResponse.instalment.cycles_executed] = {};
            paymentResponse.instalment[paymentResponse.instalment.cycles_executed].tid = tid;
            paymentResponse.instalment.formatted_cycle_amount = formattedAmount;
        }

        order.custom.novalnetServerResponse = JSON.stringify(paymentResponse);
    });
    Transaction.commit();
    return null;
}

/**
 * clear account/card details after response from novalnet
 * @param {dw.order.PaymentInstrument} paymentInstrument -  payment instrument
 */
exports.clearPaymentData = function (paymentInstrument) {
    Transaction.begin();
    Transaction.wrap(function () {
        delete paymentInstrument.custom.novalnetSepaIban;
        delete paymentInstrument.custom.novalnetPanHash;
        delete paymentInstrument.custom.novalnetUniqueId;
        delete paymentInstrument.custom.novalnetCustomerDob;
        delete paymentInstrument.custom.novalnetInstalmentCycle;
        delete paymentInstrument.custom.novalnetSavePaymentData;
        delete paymentInstrument.custom.novalnetSavedToken;
        delete session.privacy.novalnetCCDoRedirect;
        delete session.privacy.novalnetSepaBic;
    });
    Transaction.commit();
};

/**
 * get payment url
 * @param {dw.order.PaymentInstrument} paymentInstrument -  payment instrument
 * @returns {string} end point url
 */
exports.getPaymentUrl = function (paymentInstrument) {
    var orderAmount = Math.round(paymentInstrument.paymentTransaction.amount.value * 100);
    var paymentMethodId = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).ID;

    if (['NOVALNET_INVOICE', 'NOVALNET_SEPA', 'NOVALNET_CREDITCARD', 'NOVALNET_GUARANTEED_SEPA', 'NOVALNET_GUARANTEED_INVOICE', 'NOVALNET_INSTALMENT_INVOICE', 'NOVALNET_INSTALMENT_SEPA', 'NOVALNET_PAYPAL'].indexOf(paymentMethodId) > -1) {
        var config = novalnetConfig.getPaymentConfiguration(paymentMethodId);
        var onholdLimit = config.onholdAmount ? parseInt(config.onholdAmount) : 0;
        if (config.paymentAction == 'authorize' && (orderAmount >= onholdLimit)) {
            return 'https://payport.novalnet.de/v2/authorize';
        }
    }
    return 'https://payport.novalnet.de/v2/payment';
};

/**
 * get instalment details
 * @param {string} data - instalment data
 * @returns {Object} - instalment cycle details
 */
exports.getInstalmentDetails = function (data) {
    data = JSON.parse(data);
    var cycle = [];
    if (data.instalment) {
        if (data.instalment.cycle_dates) {
            var cycle_dates = data.instalment.cycle_dates;
            for (var key in cycle_dates) { // eslint-disable-line guard-for-in
                cycle.push(key);
            }
            data.instalment.totalCycles = cycle;
            return data.instalment;
        }
    }
    return [];
};

/**
 * get formatted amount
 * @param {int} amount - amount need to format
 * @param {string} currency - curreny
 * @returns {string} formattedAmount - formatted amount
 */
function getFormattedAmount(amount, currency) {
    var formatMoney = require('dw/util/StringUtils').formatMoney;
    var Money = require('dw/value/Money');
    var formattedAmount = formatMoney(new Money(amount / 100, currency));
    return formattedAmount;
}

/**
 * get saved payment details
 * @param {dw.order.Basket} basket - Current users's basket
 * @param {string} paymentType - novalnet payment type
 * @returns {Object} savedPaymentDetails - saved payment details
 */
exports.getSavedPaymentDetails = function (basket, paymentType) {
    var OrderMgr = require('dw/order/OrderMgr');
    var ArrayList = require('dw/util/ArrayList');
    var savedPaymentDetails = new ArrayList();
    var status = ['FAILURE'];

    var data = [];
    if (basket.customer.registered) {
        var systemOrders = OrderMgr.searchOrders('customerNo={0} AND custom.novalnetTid != {1} AND custom.novalnetPaymentToken != null AND custom.novalnetPaymentMethod = {2}', 'creationDate desc', basket.getCustomerNo(), null, paymentType);
        var obj;
        while (systemOrders.hasNext()) {
            var order = systemOrders.next();
            if (!empty(order.custom.novalnetServerResponse)) {
                if (status.indexOf(order.custom.novalnetPaymentStatus) > -1 || !order.custom.novalnetPaymentToken) {
                    continue;
                }

                var parsedResponse = JSON.parse(order.custom.novalnetServerResponse);
                var paymentData = parsedResponse.transaction.payment_data;
                delete paymentData.token;

                var labelText;
                if (paymentType === 'CREDITCARD') {
                    var expiryYear = paymentData.card_expiry_year.toString();
                    expiryYear = expiryYear.substring(expiryYear.length - 2, expiryYear.length);
                    
                    var expiryMonth = (paymentData.card_expiry_month.toString().length > 1) ? paymentData.card_expiry_month : '0' + paymentData.card_expiry_month;
                    labelText = Resource.msgf('novalnet.checkout.card_details', 'novalnet', null, paymentData.card_number.substring(paymentData.card_number.length - 4, paymentData.card_number.length), expiryMonth, expiryYear);
                } else {
                    labelText = 'IBAN ' + paymentData.iban;
                }

                if (data.indexOf(JSON.stringify(paymentData)) < 0) {
                    obj = {
                        token: order.custom.novalnetPaymentToken,
                        labelText: labelText,
                        paymentData: JSON.stringify(paymentData),
                        orderNo: order.orderNo,
                        orderToken: order.orderToken
                    };
                    savedPaymentDetails.push(obj);
                    data.push(JSON.stringify(paymentData));
                }

                if (savedPaymentDetails.length === 3) {
                    break;
                }
            }
        }
    }
    return savedPaymentDetails;
};

/**
 * get current date
 * @returns {string} current date
 */
exports.getCurrentDate = function () {
    var calender = require('dw/util/Calendar');
    var StringUtils = require('dw/util/StringUtils');
    return StringUtils.formatCalendar(new calender(), 'yyy-MM-dd');
};

/**
 * Format the response from novalnet server
 * @param {string} data - response from novalnet server
 * @returns {Object} novalnet payment response
 */
exports.getFormattedResult = function (data) {
    var parsedData = JSON.parse(data);

    // eslint-disable-next-line no-useless-escape
    var formattedResult = data.replace(/:(\d+)([,\}])/g, ':"$1"$2');
    formattedResult = JSON.parse(formattedResult);

    if (parsedData.transaction) {
        if (parsedData.transaction.tid) {
            parsedData.transaction.tid = formattedResult.transaction.tid;
        }
        
        if (parsedData.transaction.partner_payment_reference) {
        parsedData.transaction.partner_payment_reference = formattedResult.transaction.partner_payment_reference;
        }

        if (parsedData.transaction.service_supplier_id) {
            parsedData.transaction.service_supplier_id = formattedResult.transaction.service_supplier_id;
        }

        if (parsedData.transaction.refund) {
            if (parsedData.transaction.refund.tid) {
                parsedData.transaction.refund.tid = formattedResult.transaction.refund.tid;
            }
        }
    }

    if (parsedData.event) {
        if (parsedData.event.tid) {
            parsedData.event.tid = formattedResult.event.tid;
        }
        if (parsedData.event.parent_tid) {
            parsedData.event.parent_tid = formattedResult.event.parent_tid;
        }
    }
    return parsedData;
};

/**
 * update instalment details
 * @param {dw.order.Order} order - currenct order object
 * @param {Object} response - response from novalnet
 * @returns {void}
 */
exports.updateInstalmentDetails = function (order, response) {
    if (response.instalment) {
        var instalmentDetails = response.instalment;
        var formattedAmount = getFormattedAmount(instalmentDetails.cycle_amount, response.transaction.currency);

        instalmentDetails[response.instalment.cycles_executed] = {};
        instalmentDetails[response.instalment.cycles_executed].tid = response.event ? response.event.tid : response.transaction.tid;
        instalmentDetails.formatted_cycle_amount = formattedAmount;

        var paymentResponse = JSON.parse(order.custom.novalnetServerResponse);
        paymentResponse.instalment = instalmentDetails;

        Transaction.begin();
        Transaction.wrap(function () {
            order.custom.novalnetServerResponse = JSON.stringify(paymentResponse);
        });
        Transaction.commit();
    }
};

exports.debugLog = function (msg) {
    var novalnetLogger = require('dw/system/Logger').getLogger('Novalnet', 'novalnet');
    novalnetLogger.error(msg);
};

exports.getPaymentInstrument = getPaymentInstrument;
exports.getFormattedAmount = getFormattedAmount;
exports.getPaymentComments = getPaymentComments;
exports.formComments = formComments;
exports.addOrderNote = addOrderNote;
exports.getMerchantDetails = getMerchantDetails;
exports.getCustomerDetails = getCustomerDetails;
