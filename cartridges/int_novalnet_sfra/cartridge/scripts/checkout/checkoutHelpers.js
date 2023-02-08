/* eslint-env es6 */

'use strict';

var COHelpers = module.superModule;
/**
 * Validates payment - Overriden
 * @param {Object} req - The local instance of the request object
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {Object} an object that has error information
 */
// v1
// eslint-disable-next-line no-unused-vars
COHelpers.validatePayment = function validatePayment(req, currentBasket) {
    return { error: false };
};

module.exports = COHelpers;
