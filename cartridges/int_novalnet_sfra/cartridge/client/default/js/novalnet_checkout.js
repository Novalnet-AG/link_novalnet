/* global $ */
/* eslint-disable no-undef */

'use strict';

var scrollAnimate = require('base/components/scrollAnimate');
var currencyFormatter = require('currency-formatter');

$(document).ready(function () {
    /**
    * Display the error message on checkout page
    *
    * @param {string} errorMsg error message
    */
    function showErrorMsg(errorMsg) {
        $('.error-message').show();
        $('.error-message-text').text(errorMsg);
        scrollAnimate($('.error-message'));
    }

    $('#nn_instalment_sepa_mandate, #nn_sepa_mandate, #nn_guaranteed_sepa_mandate').click(function () {
        $('#' + this.id + '_details').toggle();
    });

    $('input[name="novalnet_creditcard_saved_token"], input[name="novalnet_sepa_saved_token"], input[name="novalnet_guaranteed_sepa_saved_token"], input[name="novalnet_instalment_sepa_saved_token"], input[name="novalnet_paypal_saved_token"]').change(function () {
        var activeTabId = $('.tab-pane.active').attr('id');
        var selectedPaymentMethod = $('#dwfrm_billing .' + activeTabId + ' .payment-form-fields input.form-control').val();
        selectedPaymentMethod = selectedPaymentMethod.toLowerCase();
        if ($('input[name="' + selectedPaymentMethod + '_saved_token"]:checked').val() === 'new_account_details') {
            $('#' + selectedPaymentMethod + '_payment_form').show();
        } else {
            $('#' + selectedPaymentMethod + '_payment_form').hide();
        }
    });

    document.querySelector('button.submit-payment').addEventListener('click', function (event) {
        var activeTabId = $('.tab-pane.active').attr('id');
        var selectedPaymentMethod = $('#dwfrm_billing .' + activeTabId + ' .payment-form-fields input.form-control').val();
        if (selectedPaymentMethod) {
            var paymentType = selectedPaymentMethod.toLowerCase();
            if (['NOVALNET_GUARANTEED_INVOICE', 'NOVALNET_GUARANTEED_SEPA', 'NOVALNET_INSTALMENT_SEPA', 'NOVALNET_INSTALMENT_INVOICE', 'NOVALNET_SEPA'].indexOf(selectedPaymentMethod) > -1) {
                if (['NOVALNET_GUARANTEED_SEPA', 'NOVALNET_INSTALMENT_SEPA', 'NOVALNET_SEPA'].indexOf(selectedPaymentMethod) > -1 && $('#novalnet_sepa_payment_form').is(':visible')) {
                    if ($('#' + paymentType + '_iban') !== undefined) {
                        var iban = NovalnetUtility.formatAlphaNumeric($('#' + paymentType + '_iban').val());
                        if (iban === '') {
                            showErrorMsg('Your account details are invalid');
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            return;
                        }
                    }
                }
                if ($('#' + paymentType + '_dob') !== undefined && $('#' + paymentType + '_dob').val() !== undefined) {
                    if ($('#' + paymentType + '_dob').val() === '' || !NovalnetUtility.validateDateFormat($('#' + paymentType + '_dob').val())) {
                        showErrorMsg('Please enter valid birth date');
                        event.preventDefault();
                        event.stopImmediatePropagation();
                    }
                }
            }
        }
    });

    $('.nn-delete-token-btn').on('click', function (event) {
        event.preventDefault();
        var orderNo = $(this).attr('data-order-no');
        var orderToken = $(this).attr('data-order-token');
        var url = $('#nnRemoveTokenUrl').val();
        $('.delete-confirmation-btn').click(function () {
            $.ajax({
                url: url,
                data: { orderNo: orderNo, orderToken: orderToken },
                dataType: 'json',
                error: function () {
                    showErrorMsg('Account details not found');
                },
                success: function (data) {
                    if (data.success) {
                        window.location.reload();
                    } else {
                        showErrorMsg('Account details not found');
                    }
                }
            });
        });
    });

    /**
    * Display the Instalment plan details on checkout page
    */
    function showInstalmentDetails() {
        var nnOrderCurrency = $('#nn_order_currency').val();
        var nnOrderAmount = $('#nn_order_amount').val();
        var instalmentPayments = ['novalnet_instalment_invoice', 'novalnet_instalment_sepa'];
        $.each(instalmentPayments, function (index, paymentType) {
            if ($('#' + paymentType + '_cycle_select').length) {
                var cycles = JSON.parse($('#' + paymentType + '_cycles').val());
                var instalmentPlanLang = $('#novalnet_instalment_plan_lang').val();
                var instalmentNetAmountLang = $('#novalnet_instalment_net_amount_lang').val();
                var instalmentTableAmountLang = $('#novalnet_instalment_table_amount_lang').val();
                var instalmentTableCycleLang = $('#novalnet_instalment_table_cycle_lang').val();
                var instalmentSelectMonthLang = $('#novalnet_instalment_month_lang').val();

                $('#' + paymentType + '_cycle_label').html(instalmentPlanLang + ' <b>(' + instalmentNetAmountLang + ' ' + currencyFormatter.format(nnOrderAmount, { code: nnOrderCurrency }) + ')  </b>');
                $('#' + paymentType + '_cycle_select').find('option').remove();
                var table = '';
                $.each(cycles, function (key, data) {
                    var instalmentAmount = (nnOrderAmount / data.value);
                    if (instalmentAmount >= 9.99) {
                        var formatedAmount = currencyFormatter.format(instalmentAmount, { code: nnOrderCurrency });
                        var text = data.value + ' x ' + formatedAmount + ' (' + instalmentSelectMonthLang + ')';
                        $('[name=' + paymentType + '_cycle_select]').append($('<option>', {
                            value: data.value,
                            text: text
                        }));

                        table += '<table class="table table-bordered novalnet-checkout-instalment-table" id="' + paymentType + '_table_' + data.value + '">';
                        table += '<tbody><tr><th>' + instalmentTableCycleLang + '</th><th>' + instalmentTableAmountLang + '</th></tr></tbody>';
                        table += '<tbody>';
                        for (var i = 1; i <= data.value; i++) {
                            table += '<tr><td>' + i + '</td><td>' + formatedAmount + '</td></tr>';
                        }
                        table += '</tbody>';
                        table += '</table>';
                    }
                });
                $('#' + paymentType + '_table').html(table);
                $('#' + paymentType + '_cycle_select').on('change', function () {
                    $("table[id^='" + paymentType + "_table_']").hide();
                    $('#' + paymentType + '_table_' + this.value).show();
                });

                var selectedCycle = $('#' + paymentType + '_cycle_select option:selected').val();
                $('#' + paymentType + '_table_' + selectedCycle).show();
            }
        });
    }

    showInstalmentDetails();
    $(document).ajaxComplete(function () {
        showInstalmentDetails();
    });
});
