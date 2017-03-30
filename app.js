"use strict";

$(document).ready(function() {

    $(".form_filter").keypress(function(e) {
        var charCode = e.charCode || e.keyCode || e.which;
        if(charCode == 13) {
            return false;
        }
    });

    var startDate = moment().subtract(7, "days").format("YYYY-MM-DD");
    var endDate = moment().format("YYYY-MM-DD");
    $("#daterange_id")
        .dateRangePicker({
            autoClose: true
        })
        .bind("datepicker-change", function() {
            mainTable.api().draw();
        });
    $("#daterange_id").data("dateRangePicker").setDateRange(startDate, endDate);

    var dropdownOptions = [];
    var rowOptions = {};
    var getCallStatusSettings = function() {
        $.ajax({
            type: "GET",
            url: "",
            success: function(results) {
                rowOptions = results['row_options'];
                dropdownOptions = results['dropdown_options'];
            }
        });
    };
    getCallStatusSettings();


    // returns hmtl for child rows
    var formatChild = function(memberData) {
        var memberPhone = memberData.phone_number;
        var contactManagerUrl = "/?q=" + memberPhone;
        var childElement = "<br><div style='margin-left:5em;'>";
        for(var key in memberData.custom_fields) {
            childElement =  "<p><span class='form__row__label'>" + key + ": </span>" +
            memberData.custom_fields[key] + "</p><br>";
        }
        return childElement + "</div>";
    };

    var mainTable = $("#main-table").dataTable({
        processing: true,
        serverSide: true,
        order: [],
        ajax: { // grab data from server
            url: "",
            type: "GET",
            data: function(data) {
                data.bucketFilter = $("#placeholder1").val()
                data.callStatusFilter = $("#call_status_filter").val()
                data.dateRange = $("#daterange_id").val()
                data.serviceArea = $("#placeholder2").val()
            }
        },
        iDisplayLength: 15,
        lengthMenu: [[15, 25, 50], [15, 25, 50]],
        columns: [
            // first column will be member_id and hidden
            {data: "member_id", visible: false, searchable: false},
            {className: 'main_dt details-control', orderable: false, data: null, defaultContent: "", width: "1em"},
            {
                data: "call_status",
                title: "Call Status",
                width: '10em',
                "class": "main_dt",
                render: function(data, type, row) { //adding drop down for this column
                	var $select = $("<select></select>");
                	$.each(dropdownOptions, function(value, index){
                        var $option = $("<option></option>", {"value": index, "text": index});
                        if(data === index){
                        	$option.attr("selected", "selected");
                        };
                    	$select.append($option);
                    });
                    return $select.prop("outerHTML");
                }
            },
            {
                data: "close_workflow",
                "class": "main_dt",
                width: "7em",
                title: "Close Workflow",
                orderable: false,
                render: function(data, type, row) {
                    var $input = $("<input type='checkbox'></input>");
                    $input.attr({
                        checked: data,
                        disabled: data
                    })
                    return $input.prop("outerHTML");
                }
            },
            {data: "service_area", title: "Service Area", "class": "main_dt"},
            {data: "action_bucket", title: "Action Bucket", "class": "main_dt"},
            {data: "first_name", title: "Name", "class": "main_dt"},
            {
                data: "phone_number",
                title: "Phone Number",
                "class": "main_dt",
                render: function(data, type, row) {
                    if(data.length == 11) {
                        data = data.substring(1);
                    }
                    var formattedPhone = "(" + data.substring(0,3) + ") " + data.substring(3,6) + " - " +
                        data.substring(6,10);
                    return formattedPhone;
                }
            },
            {data: "created_on", title: "Date Added", "class": "main_dt"}
        ],
        fnRowCallback: function(nRow, aData, iDisplayIndex, iDisplayIndexFull) {
            var currentAction = aData["call_status"];
            $(nRow).css({
                "background-color": rowOptions[currentAction]["backgroundColor"],
                "color": rowOptions[currentAction]["textColor"]
            });
            $(nRow).find('select').attr({
                disabled: rowOptions[currentAction].disabled
            });
        }
    });


    // copied code from https://datatables.net/examples/server_side/row_details.html
    // Array to track the ids of the details displayed rows
    $('#main-table tbody').on( 'click', 'tr td.details-control', function () {
        var tr = $(this).closest('tr');
        var row = mainTable.api().row( tr );

         if ( row.child.isShown() ) {
            // This row is already open - close it
            row.child.hide();
            tr.removeClass('shown');
        }
        else {
            // Open this row
            row.child( formatChild(row.data()) ).show();
            tr.addClass('shown');
        }
    } );

    $(".call_center_filters").on("change", function() {
        mainTable.api().draw();
    });


    // function is called when the select dropdown is successfully changed
    var updateCallCenterStatus = function(memberId, callStatus, rowElement) {
        $.ajax({ // make ajax call to backend to update member information in backend
            type: "POST",
            dataType: "JSON",
            url: "",
            data: {
                memberId: memberId,
                callStatus: callStatus
            }
        });

        // changes row accordingly
        $(rowElement).parent("td").siblings().andSelf().css({
            "background-color": rowOptions[callStatus]["backgroundColor"],
            "color": rowOptions[callStatus]["textColor"]
        });
        $(rowElement).attr({ disabled: rowOptions[callStatus].disabled });
    };

    mainTable.on("change", "tbody tr td select", function(e) {
            var rowElement = $(this).parent("td"); // hidden first column column is member ID
            var callStatus = $(this).val();
            var memberId = mainTable.api().row(rowElement).data()["member_id"];

            updateCallCenterStatus(memberId, callStatus, this);
        });

    // checkbox to close workflow with hermes API
    mainTable.on("click", "td input", function() {
        var checkboxElement = this;
        var tdElement = $(this).parent("td");
        var checkedMemberId = mainTable.api().row(tdElement).data()["member_id"];
        var firstName = mainTable.api().row(tdElement).data()["first_name"];
        var checkboxValue = $(this).prop("checked");

        if(checkboxValue) {
            $.ajax({
                type: "POST",
                url: "",
                dataType: "JSON",
                data: {
                    checkedMemberId: checkedMemberId
                },
                success: function(results) {
                    if(results["status"] == "Success") {
                        $(checkboxElement).attr("disabled", true);
                    } else {
                        $(checkboxElement).prop("checked", false);
                        alert(firstName + "'s workflow failed to close.");
                    }
                }
            });
        }
    });

    // timeout set to every 30 seconds
    var timeInterval = 30;
    setInterval(function() {
        // if there's any changes in the database it will update the table in success
        $.ajax({
            url: "",
            type: "GET",
            data: {
                timeInterval: timeInterval
            },
            success: function(results) {
                for(var i in results) {
                    var indexOfChangedRow = mainTable.fnFindCellRowIndexes(results[i]["member_id"]);
                    if(indexOfChangedRow.length > 0) {
                        mainTable.fnUpdate(results[i]["call_status"], indexOfChangedRow[0], 2, false);

                        var callStatus = results[i]["call_status"];
                        var element = mainTable.api().row(indexOfChangedRow[0]).node();

                        $(element).find("td").css({
                            "background-color": rowOptions[callStatus]["backgroundColor"],
                            "color": rowOptions[callStatus]["textColor"]
                        });
                        $(element).find("select").attr({ disabled: rowOptions[callStatus].disabled });
                    }
                }
            }
        });
    }, timeInterval * 1000);
});
