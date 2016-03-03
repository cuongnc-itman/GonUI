(function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD is used - Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        factory(require('jquery'));
    } else {
        // Neither AMD nor CommonJS used. Use global variables.
        if (typeof jQuery === 'undefined') {
            throw 'gonrin grid requires jQuery to be loaded first';
        }
        factory(jQuery);
    }
}(function ($) {
	'use strict';
	var Grid = function (element, options) {
		var gonrin = window.gonrin;
		var grobject = {},
		paginationOptions = {
        	serverPaging: false,
        	page: 1,
        	pageSize: 10,
        	//totalPages: null,
        	//virtualTotalPages:null,
            pageLinks: 5,
            showGotoPage: false,
            showRowsPerPage: false,
            showRowsInfo: false,
            showRowsDefaultInfo: true,
            //disable_text_selection_in_navpane: true
	    },
		language = {
			columns: "Columns",
		    columns_show_row_numbers: "Row numbers",
		    columns_default: "Default",

		    sorting: "Sorting",
		    sort_ascending: "<i class='glyphicon glyphicon-chevron-up'></i>&nbsp;&nbsp;",
		    sort_descending: "<i class='glyphicon glyphicon-chevron-down'></i>&nbsp;&nbsp;",
		    sort_none: "<i class='glyphicon glyphicon-minus'></i>&nbsp;&nbsp;",
		    sorting_default: "Default",

		    filters: "Filters",
		    filters_apply: "Apply",
		    filters_reset: "Reset",

		    select: "Select",
		    select_all_in_page: "All in page",
		    deselect_all_in_page: "None in page",
		    select_inverse_in_page: "Inverse",
		    deselect_all: "Deselect all",

		    row_index_header: "#",
		    no_records_found: "No records found"
		},
		selectedItems = [],
		data = [], //datalist
		filteredData = [],
		dataSource,
		filterExp, 
		unset = true,
        menu_template = '<ul class="dropdown-menu" style="overflow-y:scroll"></ul>',
        item_template =  '<li><a href="javascript:void(0)"></a></li>',
        
		keyMap = {
                'up': 38,
                38: 'up',
                'down': 40,
                40: 'down',
                'left': 37,
                37: 'left',
                'right': 39,
                39: 'right',
                'tab': 9,
                9: 'tab',
                'escape': 27,
                27: 'escape',
                'enter': 13,
                13: 'enter',
                'pageup': 33,
                33: 'pageup',
                'pagedown': 34,
                34: 'pagedown',
                'shift': 16,
                16: 'shift',
                'control': 17,
                17: 'control',
                'space': 32,
                32: 'space',
                //'t': 84,
                //84: 't',
                'delete': 46,
                46: 'delete'
        },
        keyState = {},
        _lastkey,
        _prev,
        _typing_timeout,
        
        /********************************************************************************
        *
        * Private API functions
        * =====================
        */
        dataToOptions = function () {
            var eData,
                dataOptions = {};

            if (element.is('div') || options.inline) {
                eData = element.data();
            }

            if (eData.dataOptions && eData.dataOptions instanceof Object) {
            	dataOptions = $.extend(true, dataOptions, eData.dataOptions);
            }
            return dataOptions;
        },
        setupWidget = function () {
			
			return grobject;
        },
        attachElementEvents = function () {
        	
        	element.unbind("cellclick").bind("cellclick", options.context? $.proxy(options.onCellClick, options.context): options.onCellClick);
            element.unbind("rowclick").bind("rowclick", options.context? $.proxy(options.onRowClick, options.context): options.onRowClick);
            element.unbind("griderror").bind("griderror", options.context? $.proxy(options.onGridError, options.context): options.onGridError);
            element.unbind("debug").bind("debug", options.context? $.proxy(options.onDebug, options.context): options.onDebug);
            element.unbind("render").bind("render", options.context? $.proxy(options.onRender, options.context): options.onRender);
            
        },
        detachElementEvents = function () {
        	element.unbind("cellclick");
        	element.unbind("rowclick");
        	element.unbind("griderror");
        	element.unbind("debug");
        	element.unbind("render");
        },
        arrayMove = function(arr, fromIndex, toIndex) {
            var element = arr[fromIndex];
            arr.splice(fromIndex, 1);
            arr.splice(toIndex, 0, element);
        },
        createId = function(prefix, pluginContainerId) {
            return prefix + pluginContainerId;
        },
        columnIsVisible = function(column) {
            var visible = "visible";
            return !column.hasOwnProperty(visible) || (column.hasOwnProperty(visible) && column[visible] === true);
        },
        columnIsSortable = function(column) {
            return (column.hasOwnProperty("sortable") && column["sortable"] !== false);
        },
        getSortableMode = function(){
        	//return false, "server", "client"
        	/*sortable: {
            	serverOrdering: false,
            },*/
        	var sortable = false;
            if(!!options.sortable){
            	
            	if(typeof options.sortable == "object"){
            		sortable = (options.sortable.hasOwnProperty("serverOrdering") && options.sortable["serverOrdering"] === true) ? "server" : "client";
            	}else if(options.sortable === true){
            		sortable = "client";
            	}
            }
            return sortable
        }, 
        renderData = function(dataToRender){
        	
        	var containerId = element.attr("id"),
	            tableId = createId(options.tableIdPrefix, containerId),
	            elemTable = element.find("#" + tableId),
	            
	            noResultsId = createId(options.noResultsIdPrefix, containerId),
	            elemNoResults = element.find("#" + noResultsId),
	            
	            filterRulesId = createId(options.filterRulesIdPrefix, containerId),
	            
	            paginationId = createId(options.paginationIdPrefix, containerId),
	            elemPagination = element.find("#" + paginationId),
	            errMsg;
        	
        	elemTable.empty();
        	
        	var serverError, filterError, primaryField, totalRows, dataLen, v,
            columns = options.fields,
            colLen = columns.length,
            column, c;
        	
        	totalRows = data.length;
            dataLen = data.length;
            
            primaryField = options.primaryField;
            
            // replace null with empty string
            if(dataToRender > 0) {
                for(v = 0; v < dataLen; v++) {
                    for(c = 0; c < colLen; c++) {
                        column = columns[c];
                        
                        if(columnIsVisible.call(elem,column)) {
                        	
                            if(dataToRender[v][column["field"]] == null) {
                            	dataToRender[v][column["field"]] = '';
                            }
                        }
                    }
                }
            };
            
            var pageNum = parseInt(options.pagination.page),
            	pageSize = parseInt(options.pagination.pageSize),
	            sortingIndicator,
	            rowIdHtml, i, row, tblHtml, rowIndex, colIdHtml,
	            offset = ((pageNum - 1) * pageSize);
	
	        tblHtml = '<thead>';
	        //rowIdHtml = (primaryField ? ' id="' + tableId + '_tr_0"' : '');
	        //tblHtml += '<tr' + rowIdHtml + '>';
	        tblHtml += '<tr class="grid-header" >';
	        
	        tblHtml += '</tr>';
            tblHtml += '</thead>';

            tblHtml += '<tbody class="grid-data">';
            tblHtml += '<tbody>';
            elemTable.html(tblHtml);
	        
            var gridHeader = elemTable.find('thead > tr.grid-header');
            var gridData = elemTable.find('tbody.grid-data');
            
            //add header
	        
	        var foundsort = false;
	        for(i in options.fields) {
                if(columnIsVisible(options.fields[i])) {
                    sortingIndicator = "";
                    if((options.sortable) && columnIsSortable(options.fields[i]) && (!foundsort)) {
                    	var sortable = options.fields[i].sortable;
                    	var sortingType = false;
                    	if(!!sortable){
                    		sortingType = sortable.order || false;
                    	}
                    	if(sortingType !== false){
                    		foundsort = true;
                    		switch(sortingType) {
	                            case "asc":
	                            	sortingIndicator = '&nbsp;<span class="' + options.sortingIndicatorAscClass + '"></span>';
	                            	break;
	                            case "desc":
	                            	sortingIndicator = '&nbsp;<span class="' + options.sortingIndicatorDescClass + '"></span>';
	                            	break;
	                            default:
	                            	sortingIndicator = '';
	                        }
                    	}
                    }
                    
                    colIdHtml = tableId + '_th_' + options.fields[i].field;
                    var thcol = $("<th>").attr("id",colIdHtml).addClass(options.commonThClass).html((options.fields[i].label || options.fields[i].field) + sortingIndicator);
                    if(options.fields[i].hasOwnProperty("width")){
                    	thcol.css("width", options.fields[i].width)
                    };
                    if(options.fields[i].hasOwnProperty("headerClass")){
                    	thcol.addClass(options.fields[i].hasOwnProperty("headerClass"))
                    };
                    gridHeader.append(thcol);
                }
            }

            for(row in dataToRender) {
            	rowIdHtml = (primaryField ? tableId + '_tr_' + dataToRender[row][primaryField] : '');
            	var trow = $("<tr>").attr("id",rowIdHtml);
            	trow.data("row_data",dataToRender[row]);
                for(i in options.fields) {
                    if(columnIsVisible(options.fields[i])) {
                    	var tcol = $("<td>");
                    	//apply cell template here:
                    	tcol.html(dataToRender[row][options.fields[i].field]);
                    	if(options.fields[i].hasOwnProperty("dataClass")){
                    		tcol.addClass(options.fields[i].hasOwnProperty("dataClass"))
                        };
                    	trow.append(tcol);
                    }
                }
                gridData.append(trow);
            }
         // refresh pagination (if needed)
            if(options.pagination !== false) {
            	if($.fn.pagination !== undefined){
            		elemPagination.pagination({
            			refresh : true,
                		page: options.pagination.page,
                    	pageSize: options.pagination.pageSize,
                    	totalPages: options.pagination.totalPages,
                    	virtualTotalPages:null,
                    	onChangePage: function(event, params){
                    		//console.log("change page");
                    		options.pagination.page = params.page;
                    		renderData(pagingData());
                    	}
                    });
            	}
            	
            }
            // no results
            if(totalRows == 0) {
            	elemPagination.hide();
                elemNoResults.show();
            } else {
            	elemPagination.show();
                elemNoResults.hide();
            }
            
         // apply given styles ------------------------------------------
            /*var col_index = options.showRowNumbers ? 1 : 0,
                headerClass = "", dataClass = "";
            for(i in s.columns) {
                if(columnIsVisible(options.fields[i])) {
                    headerClass = "", dataClass = "";
                    if(columns[i].hasOwnProperty("headerClass")) {
                        headerClass = columns[i]["headerClass"];
                    }
                    if(columns[i].hasOwnProperty("dataClass")) {
                        dataClass = columns[i]["dataClass"];
                    }
                    grid.setPageColClass.call(elem, col_index, headerClass, dataClass);
                    col_index++;
                }
            }*/
            
            
         // apply row selections ----------------------------------------
            if(options.primaryField && options.selectedItems.length > 0) {

                if(options.selectionMode == "single" || options.selectionMode == "multiple") {
                    var rowPrefixLen = (tableId + "_tr_").length,
                        rowId, idx;
                    element.find("#" + tableId + " tbody tr").each(function() {
                        rowId = parseInt($(this).attr("id").substr(rowPrefixLen));
                        idx = selectedRows("selected_index", rowId);
                        if(idx > -1) {
                            selectedRows("mark_selected", rowId);
                        }
                    });
                }
            }

            // update selected rows counter
            selectedRows("update_counter");
            
            /**
             * EVENTS ******************************************************
             */

            //TOOLS - columns list -----------------------------------------
            //Edit later
            //var settings = s;
         // row selection -----------------------------------------------
            if(options.primaryField &&
                (options.selectionMode == "single" || options.selectionMode == "multiple")) {
            	
            	var rowPrefixLen = (tableId + "_tr_").length;
                
                // click on row
            	elemTable.off("click", "tbody tr").on("click", "tbody tr", function() {
                    var rowId = parseInt($(this).attr("id").substr(rowPrefixLen)),
                        rowStatus,
                        rowData = $(this).data("row_data"),
                        idx = selectedRows("selected_index", rowData);

                    
                    if(idx > -1) {
                        selectedRows("remove_id", idx);
                        selectedRows("mark_deselected", rowData);
                        rowStatus = "deselected";
                    } else {
                        if(options.selectionMode == "single") {
                            selectedRows("clear_all_ids");
                            selectedRows("mark_page_deselected");
                        };
                        selectedRows("add_id", rowData);
                        selectedRows("mark_selected", rowData);
                        rowStatus = "selected";
                    }
                    //console.log(settings.selectedItems);
                    // update selected rows counter
                    selectedRows("update_counter");
                    element.triggerHandler("rowclick", {rowId: rowId, rowStatus: rowStatus, rowData:rowData, selectedItems: options.selectedItems});
                });
            	
            	
            	// selection list
                /*var container_id = elem.attr("id");
                var selection_list_id = createId(settings.selectionListIdPrefix, container_id);
                var elem_selection_list = elem.find("#" + selection_list_id);

                elem_selection_list.off("click", "li").on("click", "li", function() {
                    var sel_index = $(this).index();

                    if(settings.selectionMode == "single") {
                        grid.selectedRows.call(elem, "clear_all_ids");
                        grid.selectedRows.call(elem, "mark_page_deselected");
                    } else if(settings.selectionMode == "multiple") {

                        var selector_table_tr = "#" + table_id + " tbody tr",
                            row_prefix_len = (table_id + "_tr_").length,
                            row_id, idx;
                        switch(sel_index) {
                            case 0:
                                $(selector_table_tr).each(function() {
                                    row_id = parseInt($(this).attr("id").substr(row_prefix_len));
                                    idx = grid.selectedRows.call(elem, "selected_index", row_id);
                                    if(idx == -1) {
                                        grid.selectedRows.call(elem, "add_id", row_id);
                                    }
                                });
                                grid.selectedRows.call(elem, "mark_page_selected");
                                break;
                            case 1:
                                $(selector_table_tr).each(function() {
                                    row_id = parseInt($(this).attr("id").substr(row_prefix_len));
                                    idx = grid.selectedRows.call(elem, "selected_index", row_id);
                                    if(idx > -1) {
                                        grid.selectedRows.call(elem, "remove_id", idx);
                                    }
                                });
                                grid.selectedRows.call(elem, "mark_page_deselected");
                                break;
                            case 2:
                                $(selector_table_tr).each(function() {
                                    row_id = parseInt($(this).attr("id").substr(row_prefix_len));
                                    idx = grid.selectedRows.call(elem, "selected_index", row_id);
                                    if(idx > -1) {
                                        grid.selectedRows.call(elem, "remove_id", idx);
                                    } else {
                                        grid.selectedRows.call(elem, "add_id", row_id);
                                    }
                                });
                                grid.selectedRows.call(elem, "mark_page_inversed");
                                break;
                            case 4:
                                grid.selectedRows.call(elem, "clear_all_ids");
                                grid.selectedRows.call(elem, "mark_page_deselected");
                                break;
                        }
                    }

                    // update selected rows counter
                    grid.selectedRows.call(elem, "update_counter");

                });*/
            	
            	
            };
            
         // click on cell -----------------------------------------------
            /*elemTable.off("click", "tbody tr td").on("click", "tbody tr td", function() {
                var col_index = $(this).index();
                var row_index = $(this).parent("tr").index();
                element.triggerHandler("onCellClick", {col: col_index, row: row_index});
            });*/
            
            
         // columns sorting --------------------------------------
            elemTable.off("click", "thead th").on("click", "thead th", function() {
            	var rowPrefixLen = (tableId + "_th_").length;
            	var fieldName = $(this).attr("id").substr(rowPrefixLen);

            	if(options.sortable !== false){
            		var sortable = false;
            		for(var j = 0; j < options.fields.length; j ++){
                		var field = options.fields[j];
                		if(field.field !== fieldName){
                			continue;
                		}
                		//field.sortable = field.sortable || {};
                		
                		if(field.hasOwnProperty("sortable") && (field.sortable !== false)){
                			sortable = true;
                			//var order = field.sortable.order;
                			if(field.sortable.order === "asc"){
                				field.sortable.order = "desc";
                			}else{
                				field.sortable.order = "asc";
                			}
                		}
                		break;
                	}
            		//console.log(sortable);
            		if(sortable){
            			for(var j = 0; j < options.fields.length; j ++){
            				var field = options.fields[j];
                    		if(field.field !== fieldName){
                    			if(field.hasOwnProperty("sortable") && (field.sortable !== false)){
                    				field.sortable.order = false;
                    			}
                    		}
            			}
            		}
            		options.pagination.page = 1;
            		filterData();
            		sortData();
            		renderData(pagingData());
            	}
            	

            });
            
            
         // trigger event onDisplay
            element.triggerHandler("render.gonrin");
            
        },
        pagingData = function(){
        	//serverPage
        	if(options.pagination.serverPaging !== true){
        		if(filteredData.length == 0){
        			options.pagination.totalPages = 0;
        			options.pagination.page = 0;
        			return filteredData;
        		}
        		options.pagination.totalPages = (filteredData.length % options.pagination.pageSize) == 0 ? filteredData.length / options.pagination.pageSize: parseInt(filteredData.length / options.pagination.pageSize) + 1;
        		if (options.pagination.page > options.pagination.totalPages){
        			options.pagination.page = options.pagination.totalPages;
        		}
        		
        		var pagingData = [];
        		var startIndex = (options.pagination.page - 1) * options.pagination.pageSize;
        		var endIndex = (options.pagination.page - 1) * options.pagination.pageSize + options.pagination.pageSize;
        		if(endIndex > filteredData.length){
        			endIndex = filteredData.length;
        		}
        		
        		for (var i = startIndex; i < endIndex ; i++){
        			pagingData.push(filteredData[i]);
        		}
        		return pagingData;
        	}
        	
        	return filteredData;
        },
        sortData = function(){
        	var sortableMode = getSortableMode(), i;
        	
        	var foundsort = false;
        	
        	if(sortableMode === "client"){
        		for(i in options.fields) {
        			if(foundsort){
        				break;
        			}
                    if(columnIsVisible(options.fields[i]) && columnIsSortable(options.fields[i])) {
                    	
                    	var sortable = options.fields[i].sortable;
                    	var field = options.fields[i].field || false;
                    	var compare = false;
                    	var sortingType = false;
                    	
                    	if(!!sortable){
                    		sortingType = sortable.order || false;
                    		compare = sortable.compare || false;
                    	}
                    	if(sortingType !== false){
                    		foundsort = true;
                    	}else{
                    		continue;
                    	}
                    	
                    	if((filteredData != null) && (field !== false)){
	                        switch(sortingType) {
	                            case "asc":
	                            	filteredData.sort(function(a,b){
                            			if(compare !== false){
                            				return compare(a[field], b[field]);
                            			}else{
                            				return a[field] > b[field];
                            			}
                            		});
	                                break;
	                            case "desc":
	                            	filteredData.sort(function(a,b){
                            			if(compare !== false){
                            				return compare(b[field], a[field]);
                            			}else{
                            				return a[field] < b[field];
                            			}
                            		});
	                                break;
	                            default:
	                            	break;
	                        }
                    	}
                        
                    }
                }
        		
        	}else if(sortableMode === "server"){
        		
        	}
        },
        initDataSource = function(refresh){
        	dataSource = options["dataSource"];
        	if(typeof dataSource === "object"){
        		if((!!dataSource['_is_gonrin_view']) && (!!dataSource.collection)){
        			console.log('instance of collection view');
        			var view = dataSource;
        			view.collection.fetch({
                        success: function (objs) {
                        	var page = view.collection.page,
                        		num_rows = view.collection.num_rows,
                        		total_pages = view.collection.total_pages;
                        	
                        	view.collection.each(function(model) {
                        		data.push(model.attributes);
							});
                        	filterData();
                			sortData();
                    		renderData(filteredData);
                        },
                        error:function(){
                        	var filter_error;
                            var err_msg = "ERROR: " + "Collection fetch error";
                            element.html('<span style="color: red;">' + err_msg + '</span>');
                            element.triggerHandler("griderror", {err_code: "server_error", err_description: err_msg});
                            $.error(err_msg);

                            /*if(s.useFilters) {
                                var elem_filter_rules = $("#" + filter_rules_id);
                                filter_error = data["filter_error"];
                                if(filter_error["error_message"] != null) {
                                    elem_filter_rules.jui_filter_rules("markRuleAsError", filter_error["element_rule_id"], true);
                                    elem_filter_rules.triggerHandler("onValidationError", {err_code: "filter_validation_server_error", err_description: filter_error["error_message"]});
                                    $.error(filter_error["error_message"]);
                                }
                            }*/
                        },
                    });
        		}else{
        			data = dataSource;
        			filterData();
        			sortData();
        			renderData(pagingData());
        		}
        		
        	}
        },
        
        initialize = function(){
        	// initializing element and component attributes
            if (element.is('div')) {
            	if(!element.attr("id")){
            		element.attr("id","grid");
    			};
            } else {
                throw new Error('Cannot apply to non input, select element');
            }
            selectedItems = options.selectedItems || [];
            if(!options.primaryField) {
            	selectedItems = [];
            } else {
                switch(options.selectionMode) {
                    case "single":
                        if(selectedItems.length > 1) {
                        	selectedItems = [];
                        }
                        break;
                    case false:
                    	selectedItems = [];
                        break;
                }
            }
            
            var containerId = element.attr("id");
            element.removeClass().addClass(options.containerClass);
            
            var toolsId = createId(options.toolsIdPrefix, containerId),
            columns_list_id = createId(options.columnsListIdPrefix, containerId),
            default_columns_list = "",
            sorting_list_id = createId(options.sortingListIdPrefix, containerId),
            default_sorting_list = "",
            sorting_radio_name = createId(options.sortingRadioNamePrefix, containerId) + "_",
            startPos, newPos,
            selectedRows_id = createId(options.selectedRowsIdPrefix, containerId),
            selection_list_id = createId(options.selectionListIdPrefix, containerId),
            table_container_id = createId(options.tableContainerIdPrefix, containerId),
            table_id = createId(options.tableIdPrefix, containerId),
            noResultsId = createId(options.noResultsIdPrefix, containerId),
            filter_toggle_id = createId(options.filterToggleIdPrefix, containerId),
            
            pagination_id = createId(options.paginationIdPrefix, containerId),
            filter_container_id = createId(options.filterContainerIdPrefix, containerId),
            filter_rules_id = createId(options.filterRulesIdPrefix, containerId),
            filter_tools_id = createId(options.filterToolsIdPrefix, containerId),
            elemHtml = "";
            
            
         // create basic html structure ---------------------------------
            elemHtml += '<div id="' + toolsId + '" class="' + options.toolsClass + '"></div>';

            elemHtml += '<div id="' + table_container_id + '" class="' + options.datatableContainerClass + '">';
            elemHtml += '<table id="' + table_id + '" class="' + options.datatableClass + '"></table>';
            elemHtml += '</div>';

            elemHtml += '<div id="' + noResultsId + '" class="' + options.noResultsClass + '">' + language.no_records_found + '</div>';

            /*if(options.custom_html_element_id1) {
                elem_html += '<div id="' + custom_html1_id + '"></div>';
            }*/

            elemHtml += '<div id="' + pagination_id + '"></div>';

            /*if(options.custom_html_element_id2) {
                elem_html += '<div id="' + custom_html2_id + '"></div>';
            }*/

            /*if(options.useFilters) {
                elem_html += '<div id="' + filter_container_id + '" class="' + options.filterContainerClass + '">';

                elem_html += '<div id="' + filter_rules_id + '"></div>';

                elem_html += '<div id="' + filter_tools_id + '" class="' + options.filterToolsClass + '">';
                elem_html += '<button class="' + options.filterApplyBtnClass + '">' + language.filters_apply + '</button>';
                elem_html += '<button class="' + options.filterResetBtnClass + '">' + language.filters_reset + '</button>';

                elem_html += '</div>';
            }*/

            elemHtml += '</div>';

            element.html(elemHtml);
            element.find("#" + noResultsId).hide();
            
            var elemTools = element.find("#" + toolsId);
            
            var toolsHtml = $("<div>").addClass("btn-group").appendTo(elemTools);
            
            if(options.tools){
            	for(var i = 0; i < options.tools.length; i ++){
            		var button = $("<button>").addClass("btn btn-sm").attr({"type":"button","name": options.tools[i].name}).html(options.tools[i].label || options.tools[i].name);
            		button.addClass(options.tools[i].buttonClass || "btn-default");
            		if(options.tools[i].command){
            			button.bind("click", $.proxy(options.tools[i].command, options.context));
            		}
            		toolsHtml.append(button);
            	}
            }

            /*var elem_tools = element.find("#" + tools_id),
            elemTable = element.find("#" + table_id),
            elem_pagination = element.find("#" + pagination_id);*/
            
            initDataSource(true);
        },
        selectedRows = function(action, row_data) {
            var containerId = element.attr("id"),
                table_id = createId(options.tableIdPrefix, containerId),
                selectedTrClass = options.selectedTrClass,
                selector_table_tr = "#" + table_id + " tbody tr",
                table_tr_prefix = "#" + table_id + "_tr_";
            
            var id = row_data ? row_data[options.primaryField] : null;
            
            switch(action) {
                case "get_ids":
                	if(options.selectionMode == "single") {
                		return options.selectedItems;
                	};
                	if(options.selectionMode == "multiple") {
                		/*TODO*/
                		return options.selectedItems;
                	};
                    
                    break;
                case "clear_all_ids":
                	options.selectedItems = [];
                    break;
                case "update_counter":
                    var selectedRowsId = createId(options.selectedRowsIdPrefix, containerId);
                    element.find("#" + selectedRowsId).text(options.selectedItems.length);
                    break;
                case "selected_index":
                	return $.inArray(row_data, options.selectedItems);
                    break;
                case "add_id":
                	options.selectedItems.push(row_data);
                    break;
                case "remove_id":
                	options.selectedItems.splice(row_data, 1);
                    break;
                case "mark_selected":
                	element.find(table_tr_prefix + id).addClass(selectedTrClass);
                    break;
                case "mark_deselected":
                	element.find(table_tr_prefix + id).removeClass(selectedTrClass);
                    break;
                case "mark_page_selected":
                	element.find(selector_table_tr).addClass(selectedTrClass);
                    break;
                case "mark_page_deselected":
                	element.find(selector_table_tr).removeClass(selectedTrClass);
                    break;
                case "mark_page_inversed":
                	element.find(selector_table_tr).toggleClass(selectedTrClass);
                    break;
            }

        },
        filterData = function(){
        	var query = options.filters;
        	if(query !== null){
        		filteredData = _.query( data, query);
        	}else{
        		filteredData = data
        	}
        	
        };
        
        /********************************************************************************
        *
        * Public API functions
        * =====================
        */
        grobject.getVersion = function() {
            return "0.0.1";
        };
        
        grobject.options = function (newOptions) {
            if (arguments.length === 0) {
                return $.extend(true, {}, options);
            }

            if (!(newOptions instanceof Object)) {
                throw new TypeError('options() options parameter should be an object');
            }
            $.extend(true, options, newOptions);
            return grobject;
        };
        
        grobject.getOption= function(opt) {
            return options[opt];
        };
        
        grobject.getAllOptions = function() {
            return options;
        };
        
        grobject.filter = function(query){
        	options.filters = query;
        	filterData();
        	sortData();
        	renderData(pagingData());
        };
        
        

        $.extend(true, options, dataToOptions());
        
        options.pagination = $.extend({}, paginationOptions, options.pagination || {});
        language = $.extend({}, language, options.language || {});
        grobject.options(options);
        initialize();
    	setupWidget();
        attachElementEvents();
        return grobject;
		
	};
	
/*****************************************/
	
	$.fn.grid = function (options) {
        return this.each(function () {
            var $this = $(this);
            options.refresh = options.refresh || false;
            if ($this.data('gonrin') && options.refresh){
            	$this.data('gonrin', null);
            }
            if (!$this.data('gonrin')) {
                // create a private copy of the defaults object
                options = $.extend(true, {}, $.fn.grid.defaults, options);
                $this.data('gonrin', Grid($this, options));
            }
        });
    };

    $.fn.grid.defaults = {
    	refresh: false,
    	context: null,
    	dataSource: null,
        primaryField: "",
        selectionMode: "single", // "multiple", "single", false
        selectedItems: [],
        /**
         * MANDATORY PROPERTIES: field
         * UNIQUE PROPERTIES: field
         * {field: "customer_id", header: "Code", visible: "no", is_function: "no", "headerClass": "th_code hidden-xs", "dataClass": "td_code hidden-xs"},
         */
        fields: [],
        /**
         * See bs_pagination plugin documentation
         */
        pagination: null,
        
        filters: null,
        tools: null,
        showRowNumbers: false,
        
        // events
        onCellClick: function() {
        },
        onRowClick: function() {
        },
        onGridError: function() {
        },
        onDebug: function() {
        },
        onRender: function() {
        },
        //serverOrdering: false,
        //serverFiltering: false,
        sortable: {
        	serverOrdering: false,
        },
        useSortableLists: true,
        
        // bs 3
        containerClass: "grid_container",
        noResultsClass: "alert alert-warning no-records-found",

        toolsClass: "tools",

        columnsListLaunchButtonClass: "btn btn-default dropdown-toggle",
        columnsListLaunchButtonIconClass: "glyphicon glyphicon-th",
        columnsListClass: "dropdown-menu dropdown-menu-right",
        columnsListLabelClass: "columns-label",
        columnsListCheckClass: "col-checkbox",
        columnsListDividerClass: "divider",
        columnsListDefaultButtonClass: "btn btn-primary btn-xs btn-block",

        sortingListLaunchButtonIconClass: "glyphicon glyphicon-sort",
        sortingLabelCheckboxClass: "radio-inline",
        sortingNameClass: "sorting-name",

        selectButtonIconClass: "glyphicon  glyphicon-check",
        selectedRowsClass: "selected-rows",

        filterToggleButtonIconClass: "glyphicon glyphicon-filter",
        filterToggleActiveClass: "btn-info",

        sortingIndicatorAscClass: "glyphicon glyphicon-chevron-up text-muted",
        sortingIndicatorDescClass: "glyphicon glyphicon-chevron-down text-muted",

        datatableContainerClass: "table-responsive",
        datatableClass: "table table-bordered table-hover",
        commonThClass: "th-common",
        selectedTrClass: "warning",

        filterContainerClass: "well filters-container",
        filterToolsClass: "",
        filterApplyBtnClass: "btn btn-primary btn-sm filters-button",
        filterResetBtnClass: "btn btn-default btn-sm filters-button",

        // prefixes
        toolsIdPrefix: "tools_",
        columnsListIdPrefix: "columns_list_",
        sortingListIdPrefix: "sorting_list_",
        sortingRadioNamePrefix: "sort_radio_",
        selectedRowsIdPrefix: "selectedRows_",
        selectionListIdPrefix: "selection_list_",
        filterToggleIdPrefix: "filter_toggle_",

        tableContainerIdPrefix: "tbl_container_",
        tableIdPrefix: "tbl_",

        noResultsIdPrefix: "no_res_",

        //custom_html1_id_prefix: "custom1_",
        //custom_html2_id_prefix: "custom2_",

        paginationIdPrefix: "pag_",
        filterContainerIdPrefix: "flt_container_",
        filterRulesIdPrefix: "flt_rules_",
        filterToolsIdPrefix: "flt_tools_",
        // misc
        debugMode: false
    };
}));