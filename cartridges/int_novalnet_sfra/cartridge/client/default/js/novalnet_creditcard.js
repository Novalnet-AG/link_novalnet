/* global $ */
/* eslint-disable no-unused-vars, no-undef */

'use strict';

var scrollAnimate = require('base/components/scrollAnimate');

$(document).ready(function () {
    document.querySelector('button.submit-payment').addEventListener('click', function (event) {
        var activeTabId = $('.tab-pane.active').attr('id');
        var selectedPaymentMethod = $('#dwfrm_billing .' + activeTabId + ' .payment-form-fields input.form-control').val();

        if (selectedPaymentMethod === 'NOVALNET_CREDITCARD') {
            $('#nn_pan_hash, #nn_unique_id, #nn_do_redirect').val('');
            if ($('#novalnet_iframe').is(':visible')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                NovalnetUtility.getPanHash();
            }
        }
    });

    /**
    * Loads the creditcard iframe on checkout page
    */
    function loadIframe() {
        var billingForm = document.getElementById('dwfrm_billing');
        var nnOrderAmount = $('#nn_order_amount').val() * 100;
        var nnOrderCurrency = $('#nn_order_currency').val();
        var config = JSON.parse($('#nn_payment_config').val());
        var clientKey = $('#nn_client_key').val();
        var lang = $('#nn_current_lang').val();
        var email = $('#nn_customer_email').val();
        if(billingForm.querySelector('input[name$="_email"]') != null) {
            email = billingForm.querySelector('input[name$="_email"]').value;
        }
        NovalnetUtility.setClientKey(clientKey);

        var configurationObject = {

            // You can handle the process here, when specific events occur.
            callback: {

                // Called once the pan_hash (temp. token) created successfully.
                on_success: function (data) {
                    $('#nn_pan_hash').val(data.hash);
                    $('#nn_unique_id').val(data.unique_id);
                    $('#nn_do_redirect').val(data.do_redirect);
                    $('.submit-payment').click();
                    return true;
                },

                // Called in case of an invalid payment data or incomplete input.
                on_error: function (data) {
                    if (data.error_message !== undefined) {
                        $('.error-message').show();
                        $('.error-message-text').text(data.error_message);
                        scrollAnimate($('.error-message'));
                        return false;
                    }
                },

                // Called in case the challenge window Overlay (for 3ds2.0) displays
                on_show_overlay: function (data) {
                    document.getElementById('novalnet_iframe').classList.add('novalnet-challenge-window-overlay');
                },

                // Called in case the Challenge window Overlay (for 3ds2.0) hided
                on_hide_overlay: function (data) {
                    document.getElementById('novalnet_iframe').classList.remove('novalnet-challenge-window-overlay');
                },
                on_show_captcha: function (result) {

                }
            },

            // You can customize your Iframe container styel, text etc.
            iframe: {

                // It is mandatory to pass the Iframe ID here.  Based on which the entire process will took place.
                id: 'novalnet_iframe',

                // Set to 1 to make you Iframe input container more compact (default - 0)
                inline: config.inlineForm ? 1 : 0,

                // Add the style (css) here for either the whole Iframe contanier or for particular label/input field
                style: {
                    // The css for the Iframe container
                    container: config.textStyle ? config.textStyle : '',

                    // The css for the input field of the Iframe container
                    input: config.inputStyle ? config.inputStyle : '',

                    // The css for the label of the Iframe container
                    label: config.labelStyle ? config.labelStyle : ''
                },

                // You can customize the text of the Iframe container here
                text: {

                    // You can customize the text for the Card Holder here
                    card_holder: {
                        // You have to give the Customized label text for the Card Holder Container here
                        label: $('#novalnet_cc_holder_label_lang').val(),

                        // You have to give the Customized placeholder text for the Card Holder Container here
                        place_holder: $('#novalnet_cc_holder_placeholder_lang').val()
                    },
                    card_number: {

                        // You have to give the Customized label text for the Card Number Container here
                        label: $('#novalnet_cc_number_label_lang').val(),

                        // You have to give the Customized placeholder text for the Card Number Container here
                        place_holder: $('#novalnet_cc_number_placeholder_lang').val()

                    },
                    expiry_date: {

                        // You have to give the Customized label text for the Expiry Date Container here
                        label: $('#novalnet_cc_expirydate_label_lang').val()
                    },
                    cvc: {

                        // You have to give the Customized label text for the CVC/CVV/CID Container here
                        label: $('#novalnet_cc_cvc_label_lang').val(),

                        // You have to give the Customized placeholder text for the CVC/CVV/CID Container here
                        place_holder: $('#novalnet_cc_cvc_placeholder_lang').val()
                    }
                }
            },

            // Add Customer data
            customer: {

                // Your End-customer's First name which will be prefilled in the Card Holder field
                first_name: billingForm.querySelector('input[name$="_firstName"]').value,

                // Your End-customer's Last name which will be prefilled in the Card Holder field
                last_name: billingForm.querySelector('input[name$="_lastName"]').value,

                // Your End-customer's Email ID.
                email: email,

                // Your End-customer's billing address.
                billing: {

                    // Your End-customer's billing street (incl. House no).
                    street: billingForm.querySelector('input[name$="_address1"]').value,

                    // Your End-customer's billing city.
                    city: billingForm.querySelector('input[name$="_city"]').value,

                    // Your End-customer's billing zip.
                    zip: billingForm.querySelector('input[name$="_postalCode"]').value,

                    // Your End-customer's billing country ISO code.
                    country_code: billingForm.querySelector('select[name$="_country"]').value
                }
            },

            // Add transaction data
            transaction: {

                // The payable amount that can be charged for the transaction (in minor units), for eg:- Euro in Eurocents (5,22 EUR = 522).
                amount: nnOrderAmount,

                // The three-character currency code as defined in ISO-4217.
                currency: nnOrderCurrency,

                // Set to 1 for the TEST transaction (default - 0).
                test_mode: config.testMode,

                enforce_3d: config.enforce3d ? 1 : 0
            },
            custom: {
                lang: lang
            }
        };
        // Create the Credit Card form
        NovalnetUtility.createCreditCardForm(configurationObject);
    }

    loadIframe();
    $(document).ajaxComplete(function () {
        loadIframe();
    });
});
