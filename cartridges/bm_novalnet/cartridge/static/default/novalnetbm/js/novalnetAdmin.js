/* global Ext jQuery */
/* eslint-disable no-shadow */
var novalnetAdmin = (function ($) {
    var transactionDetailWindow;

    function loadOrderTransaction(orderNo, orderToken, showCommentTable) {
        var data = {
            format: 'ajax',
            orderNo: orderNo,
            orderToken: orderToken
        };
        transactionDetailWindow.maskOver.show();
        $.ajax({
            url: novalnetAdmin.urls.orderTransaction,
            data: data,
            error: function () {
                transactionDetailWindow.maskOver.hide();
                if (transactionDetailWindow) {
                    transactionDetailWindow.close();
                }
            },
            success: function (data) {
                transactionDetailWindow.maskOver.hide();
                if (transactionDetailWindow) {
                    $('#' + transactionDetailWindow.body.id).html(data);
                    transactionDetailWindow.setHeight('auto');
                    transactionDetailWindow.center();
                } else {
                    $('.js_novalnetbm_content').html(data);
                }

                if (showCommentTable) {
                    $('#novalnet_comments_table').show();
                }

                $('.novalnetbm_td_button').on('click', function () {
                    var tableId = '#' + $(this).attr('data-id');
                    $(tableId).toggle();
                    $('.nn_table').not(tableId).hide();
                });

                $('.novalnet_show_instalment_refund').on('click', function () {
                    var tableId = $(this).attr('data-id');
                    $('#novalnet_instalment_refund_table_' + tableId).show();
                    $(this).hide();
                });

                $('.novalnet_hide_instalment_refund').on('click', function () {
                    var tableId = $(this).attr('data-id');
                    $('#novalnet_instalment_refund_table_' + tableId).hide();
                    $('.novalnet_show_instalment_refund[data-id="' + tableId + '"]').show();
                });

                $('#novalnet_manage_transaction_submit').on('click', function () {
                    var tid = $('#novalnet_transaction_id').val();
                    var orderNo = $('#novalnet_order_no').val();
                    var orderToken = $('#novalnet_order_token').val();
                    var action = $('#novalnet_transaction_action option:selected').val();
                    var confirmMsg = (action === 'capture') ? novalnetAdmin.resources.captureConfirmMsg : novalnetAdmin.resources.voidConfirmMsg;
                    Ext.MessageBox.confirm('Confirm', confirmMsg, callbackFunction);
                    function callbackFunction(btn) {
                        if (btn === 'yes') {
                            var data = { tid: tid, orderNo: orderNo, orderToken: orderToken, action: action };
                            executeAction(data);
                        }
                    }
                });

                $('#novalnet_cancel_instalment').on('click', function () {
                    var tid = $('#novalnet_transaction_id').val();
                    var orderNo = $('#novalnet_order_no').val();
                    var orderToken = $('#novalnet_order_token').val();
                    var confirmMsg = novalnetAdmin.resources.voidConfirmMsg;
                    Ext.MessageBox.confirm('Confirm', confirmMsg, callbackFunction);
                    function callbackFunction(btn) {
                        if (btn === 'yes') {
                            var data = { tid: tid, orderNo: orderNo, orderToken: orderToken, action: 'instalment_cancel' };
                            executeAction(data);
                        }
                    }
                });

                $('.novalnet_submit_refund_form').on('click', function () {
                    var refundReason = '';
                    var refundAmount = '';

                    var tid = $(this).attr('data-tid');
                    var id = $(this).attr('data-id');
                    var payment = $(this).attr('data-payment');

                    if (payment === 'instalment') {
                        refundAmount = $('#novalnet_refund_amount_' + id).val();
                    } else {
                        refundReason = $('#novalnet_refund_reason').val();
                        refundAmount = $('#novalnet_refund_amount').val();
                    }


                    var orderNo = $('#novalnet_order_no').val();
                    var orderToken = $('#novalnet_order_token').val();
                    if (!refundAmount || refundAmount === 0) {
                        Ext.Msg.alert('Error', novalnetAdmin.resources.refundAmountInvalid);
                        return;
                    }
                    Ext.MessageBox.confirm('Confirm', novalnetAdmin.resources.refundConfirmMsg, callbackFunction);
                    function callbackFunction(btn) {
                        if (btn === 'yes') {
                            var data = {
                                tid: tid, orderNo: orderNo, orderToken: orderToken, refundAmount: refundAmount, reason: refundReason, action: 'refund'
                            };
                            executeAction(data);
                        }
                    }
                });
                
                $('.novalnet_submit_zero_amount_booking_form').on('click', function () {
                    var refundReason = '';
                    var refundAmount = '';

                    var tid = $(this).attr('data-tid');
					var amount = $('#novalnet_booking_amount').val();
                    
                    var orderNo = $('#novalnet_order_no').val();
                    var orderToken = $('#novalnet_order_token').val();
                    if (!amount || amount <= 0) {
                        Ext.Msg.alert('Error', novalnetAdmin.resources.amountInvalid);
                        return;
                    }
                    Ext.MessageBox.confirm('Confirm', novalnetAdmin.resources.bookingConfirmMsg, callbackFunction);
                    function callbackFunction(btn) {
                        if (btn === 'yes') {
                            var data = {
                                tid: tid, orderNo: orderNo, orderToken: orderToken, amount: amount, action: 'zero_amount_booking'
                            };
                            executeAction(data);
                        }
                    }
                });
                
                $('#novalnet_booking_amount').keyup(function () {
					this.value = this.value.replace(/[^0-9]/g,'');
				});
            }
        });
    }

    function executeAction(requestData) {
        transactionDetailWindow.maskOver = createMaskOver(transactionDetailWindow);
        transactionDetailWindow.maskOver.show();
        var orderNo = requestData.orderNo;
        var orderToken = requestData.orderToken;
        $.ajax({
            url: novalnetAdmin.urls.action,
            data: requestData,
            dataType: 'json',
            error: function () {
                transactionDetailWindow.maskOver.hide();
                Ext.Msg.alert('Error', 'Error');
                transactionDetailWindow.close();
            },
            success: function (data) {
                if (data && data.statusText) {
                    Ext.Msg.alert('Success', data.statusText);
                    loadOrderTransaction(orderNo, orderToken, true);
                } else {
                    Ext.Msg.alert('Error', 'Error');
                    transactionDetailWindow.close();
                }
            }
        });
    }

    function initEvents() {
        $('.js_novalnet_show_detail').on('click', function () {
            var $button = $(this);
            transactionDetailWindow = new Ext.Window({
                title: $button.attr('title'),
                width: 1000,
                height: 200,
                modal: true,
                autoScroll: true,
                cls: 'novalnetbm_window_content'
            });
            transactionDetailWindow.show();
            transactionDetailWindow.maskOver = createMaskOver(transactionDetailWindow);
            loadOrderTransaction($button.data('orderno'), $button.data('ordertoken'));
            return false;
        });
    }

    function createMaskOver(panel) {
        return (function () {
            return {
                ext: new Ext.LoadMask(panel.getEl()),
                show: function () {
                    this.ext.msg = novalnetAdmin.resources.waitMsg;
                    this.ext.show();
                },
                hide: function () {
                    this.ext.hide();
                }
            };
        }());
    }

    return {
        init: function (config) {
            $.extend(this, config);
            $(document).ready(function () {
                initEvents();
            });
        }
    };
}(jQuery));
