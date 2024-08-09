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
    
    var nnPaymentDetails = JSON.parse(paymentInstrument.custom.novalnetPaymentDetails);
	var paymentType = nnPaymentDetails.payment_details.type;
	var bookingDetails = nnPaymentDetails.booking_details;
		
    if(bookingDetails.cycle) {
		data.instalment = {
            interval: '1m',
            cycles: bookingDetails.cycle
        };
	}
    
    if(paymentType == 'PAYPAL') {
		data.cart_info = getCartDetails(order);
	}

    data.custom = getCustomParam(order);

    return data;
};

function getCustomParam(order) {
	var customParams = {
        lang: novalnetConfig.getCurrentLang(),
        input1: 'orderToken',
        inputval1: order.orderToken
	};
	return customParams;
}

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
    
    var nnPaymentDetails = JSON.parse(paymentInstrument.custom.novalnetPaymentDetails);
    if(!empty(nnPaymentDetails)) {
		var bookingDetails = nnPaymentDetails.booking_details;
		if(!empty(bookingDetails.birth_date)) {
			customer.birth_date = bookingDetails.birth_date;
		}
	}
    
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
    return customer;
}

function getSystemVersion() {
	var systemVersion = 'NN13.0.0';
	var sfraVersion = Resource.msg('global.version.number', 'version', null);
	if(sfraVersion) {
		systemVersion = 'SFRA' + sfraVersion + '-' + systemVersion;
	}
	return systemVersion;
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
    
	var transaction = {
        amount: amount,
        currency: order.getCurrencyCode(),
        order_no: order.orderNo,
        system_name: 'salesforce-commerce-cloud',
        system_version: getSystemVersion()
    };
    
    var nnPaymentDetails = paymentInstrument.custom.novalnetPaymentDetails;
    if(!empty(nnPaymentDetails)) {
		nnPaymentDetails = JSON.parse(paymentInstrument.custom.novalnetPaymentDetails);
		
		var bookingDetails = nnPaymentDetails.booking_details;
		var paymentDetails = nnPaymentDetails.payment_details;
		
		transaction.test_mode = bookingDetails.test_mode;
		transaction.payment_type = paymentDetails.type;
		
		var paymentDataKeys = ['pan_hash', 'unique_id', 'iban', 'bic', 'account_holder', 'wallet_token'];
		
		transaction.payment_data = {};
		paymentDataKeys.forEach(function (key) {
			if(bookingDetails[key]) {
				transaction.payment_data[key] = bookingDetails[key];
			}
		});
		
		if(!empty(bookingDetails.create_token)) {
			transaction.create_token = 1;
		}
		
		if(!empty(bookingDetails.enforce_3d)) {
			transaction.enforce_3d = 1;
		}
		
		if(!empty(bookingDetails.due_date)) {
			var date = new Date();
            date.setDate(date.getDate() + parseInt(bookingDetails.due_date));
            var year = date.getFullYear().toString();
            var month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
            var day = date.getDate().toString();
            transaction.due_date = year + '-' + (month[1] ? month : '0' + month[0]) + '-' + (day[1] ? day : '0' + day[0]);
		}
		
		var paymentAction = !empty(bookingDetails.payment_action) ? bookingDetails.payment_action : '';
		if(paymentAction == "zero_amount") {
			transaction.amount = 0;
			transaction.create_token = 1;
		}
		
		if(!empty(bookingDetails.account_number)) {
			transaction.payment_data.account_holder = bookingDetails.account_holder;
			transaction.payment_data.account_number = bookingDetails.account_number;
			transaction.payment_data.routing_number = bookingDetails.routing_number;
		}
		
		if(!empty(bookingDetails.payment_ref) && !empty(bookingDetails.payment_ref.token)) {
			transaction.payment_data.token = bookingDetails.payment_ref.token;
			delete transaction.create_token;
		}
		
		if(empty(transaction.payment_data)) {
			delete transaction.payment_data;
		}
		
		if((paymentDetails.process_mode && paymentDetails.process_mode == 'redirect') || (bookingDetails.do_redirect && (bookingDetails.do_redirect == 1 || bookingDetails.do_redirect == true))) {
			transaction.return_url = URLUtils.https('Novalnet-HandleResponse', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString();
			transaction.error_return_url = URLUtils.https('Novalnet-HandleResponse', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString();
		}
	}

    return transaction;
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
        order.addNote(Resource.msg('novalnet.transaction_details', 'novalnet', null), comment);
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
function formComments(paymentResponse, order, isSuccess) {
    var newLine = '\n';
    var comment = '';
    var tid = paymentResponse.transaction ? (paymentResponse.transaction.tid ? paymentResponse.transaction.tid.toString() : null) : null;
    var test_mode = paymentResponse.transaction ? paymentResponse.transaction.test_mode : null;

    if (tid) {
        comment += Resource.msgf('novalnet.transactionid', 'novalnet', null, tid);
        comment += newLine;
    }
    if(order) {
		var paymentInstrument = getPaymentInstrument(order);
		var paymentName = paymentInstrument.custom.novalnetPaymentName;
		if(!empty(paymentName)) {
			comment += paymentName + newLine;
		}
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
		comment += Resource.msg('novalnet.invoice.paymentreference', 'novalnet', null) + ' 1: ' + tid + newLine;
		if(paymentResponse.transaction.invoice_ref) {
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
function getPaymentInstrument(order) {
    for (var i = 0; i < order.paymentInstruments.length; i += 1) {
        var paymentInstrument = order.paymentInstruments[i];

        if (paymentInstrument.paymentMethod.indexOf('NOVALNET_') > -1) {
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
    var comment = formComments(paymentResponse, order, true);
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
    var comment = formComments(paymentResponse, order, false);
    addOrderNote(order, comment, false);
};

/**
 * saves novalnet transaction details
 * @param {dw.order.Order} order - order
 * @param {Object} paymentResponse - novalnet response
 * @returns {void}
 */
function saveTransactionDetails(order, paymentResponse) {
    var paymentInstrument = getPaymentInstrument(order);
    var tid = paymentResponse.transaction.tid.toString();
    var paidAmount = 0;
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

        if (paymentResponse.transaction.payment_data) {
			if (paymentResponse.transaction.payment_data.token) {
				order.custom.novalnetPaymentToken = paymentResponse.transaction.payment_data.token;
				
				if (paymentResponse.transaction.amount == 0) {
					order.custom.novalnetZeroAmountBooking = true;
				}
			}
        }

        if (paymentResponse.instalment && paymentResponse.transaction.status === 'CONFIRMED') {
            paymentResponse.instalment[paymentResponse.instalment.cycles_executed] = {};
            paymentResponse.instalment[paymentResponse.instalment.cycles_executed].tid = tid;
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
        delete paymentInstrument.custom.novalnetPaymentDetails;
        delete paymentInstrument.custom.novalnetSelectedPaymentData;
    });
    Transaction.commit();
};

/**
 * get payment url
 * @param {dw.order.PaymentInstrument} paymentInstrument -  payment instrument
 * @returns {string} end point url
 */
exports.getPaymentUrl = function (paymentAction) {
	if (paymentAction == 'authorized') {
		return 'https://payport.novalnet.de/v2/authorize';
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
    var totalCycleCount = 0;
    var isAllCyclesExecuted = 1;
    if (data.instalment) {    
        if (data.instalment.cycle_dates) {
            var cycle_dates = data.instalment.cycle_dates;
            for (var key in cycle_dates) { // eslint-disable-line guard-for-in
				if(!data.instalment[key]) {
					isAllCyclesExecuted = 0;
				}
                cycle.push(key);
                totalCycleCount += 1;
            }
            data.instalment.total_cycles = cycle;
            data.instalment.total_cycle_count = totalCycleCount;
            var totalInstalmentAmount = data.instalment.total_amount ? data.instalment.total_amount : data.transaction.amount;
            var differenceAmount = data.instalment.cycle_amount * totalCycleCount - totalInstalmentAmount;
            data.instalment.formatted_last_cycle_amount = getFormattedAmount(data.instalment.cycle_amount - differenceAmount, data.transaction.currency);
            data.instalment.last_cycle_amount = data.instalment.cycle_amount - differenceAmount;
            data.instalment.formatted_cycle_amount = getFormattedAmount(data.instalment.cycle_amount, data.transaction.currency);
            data.instalment.all_cycles_executed = isAllCyclesExecuted;
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

        instalmentDetails[response.instalment.cycles_executed] = {};
        instalmentDetails[response.instalment.cycles_executed].tid = response.event ? response.event.tid : response.transaction.tid;
        
        var paymentResponse = JSON.parse(order.custom.novalnetServerResponse);
        paymentResponse.instalment = instalmentDetails;

        Transaction.begin();
        Transaction.wrap(function () {
            order.custom.novalnetServerResponse = JSON.stringify(paymentResponse);
        });
        Transaction.commit();
    }
};

/**
* Gets the clientKey.
*
* @returns {string} clientKey
*/
exports.getWalletParams = function (basket) {	
	var cartInfo = {};
    var cartLineItems = [];
    var cartLineItem = {};
    // iterate all product line items of the basket and set prices
    var productLineItems = basket.getAllProductLineItems().iterator();
    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();
		var productAmount = (productLineItem.getAdjustedNetPrice().getValue() / productLineItem.getQuantityValue());
		cartLineItem = {
			label: productLineItem.getProductName() + ' x ' + productLineItem.getQuantityValue(),
			amount: Math.round(productAmount * 100),
			type: 'LINE_ITEM',
		};
		cartLineItems.push(cartLineItem);
	}
	
	cartLineItem = {
		label : Resource.msg('novalnet.tax', 'novalnet', null),
		type: 'TAX',
		amount: Math.round(basket.getTotalTax().getValue() * 100),
	};
	cartLineItems.push(cartLineItem);
	
	cartLineItem = {
		label : Resource.msg('novalnet.shipping', 'novalnet', null),
		type: 'SUBTOTAL',
		amount: Math.round(basket.getShippingTotalNetPrice().getValue() * 100)
	};
	cartLineItems.push(cartLineItem);
	
	var responseData = {
		lineItems: cartLineItems
	};
	return JSON.stringify(responseData);
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
exports.getTransactionDetails = getTransactionDetails;
exports.getCustomParam = getCustomParam;
exports.getSystemVersion = getSystemVersion;
