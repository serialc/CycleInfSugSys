// BRS.js
// contains all the mapping, categorization functions

// display base map and markers
BRS.init = function() {
	// create global map object lists
	BRS.mapped_features = [];
	BRS.features = [];

	// define variables
	var osm_path = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
		osm_attribution = '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
		osm = new L.TileLayer(osm_path, {minZoom: BRS.config.lowest_zoom_val, attribution: osm_attribution});
		ocm_path = 'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png',
		ocm_attribution = '&copy <a href="http://www.opencyclemap.org/">OpenCycleMap</a> - <a href="http://www.opencyclemap.org/docs/">Legend</a>,', 
		ocm = new L.TileLayer(ocm_path, {minZoom: BRS.config.lowest_zoom_val, attribution: ocm_attribution});

	// create the map
	BRS.map = L.map('map', {
		center: BRS.config.center,
		attributionControl: false,
		zoom: BRS.config.initial_zoom_level,
		layers: [osm]
	})

	// lock the map to a fixed area if requested
	if ( BRS.config.area_locked ) {
		BRS.map.setMaxBounds( BRS.config.bounds );
	}

	var baseMaps = {
		"Open Cycle Map": ocm,
		"Open Street Map": osm
	};

	// add attribution 'control' to map
	L.control.attribution({position: 'topright'}).addAttribution(osm_attribution).addTo(BRS.map);
	// add basemap controls to map
	L.control.layers(baseMaps, null, {position: 'topright'}).addTo(BRS.map);

	// create a generic empty popup item that we populate later
	BRS.popup = L.popup();

	// only allow editing at zoomed in level
	BRS.map.on('zoomend', BRS.zoomLock);

	// create event handlers shape creations
	BRS.map.on('draw:created', function(e) {
			var type = e.layerType,
				coords;

			if ( type === 'marker' ) {
				coords = e.layer.getLatLng();
				BRS.shape = L.marker(coords).addTo(BRS.map);
				centre = coords;
			}

			if ( type === 'polyline' ) {
				coords = e.layer.getLatLngs();
				BRS.shape = L.polyline(coords).addTo(BRS.map);
				centre = BRS.shape.getBounds().getCenter()
			}

			if ( type === 'polygon' ) {
				coords = e.layer.getLatLngs();
				BRS.shape = L.polygon(coords).addTo(BRS.map);
				centre = BRS.shape.getBounds().getCenter()
			}

			shape_id = BRS.coords_to_string(centre, '_');
			str_coords = BRS.coords_to_string(coords, ',');

			html_form = "<h3>Describe this location</h3>" +
				"<form>" +
				"<p>Your name: <input id='sug_name' class='ialign' type='text'/></p>" +
				"<p>Title: <input id='sug_title' class='ialign' type='text'/></p>" +
				"<div style='height: 5em;'><p>Comment: <textarea id='sug_com' class='ialign' type='text'></textarea></p></div>\n";

			// add category options
			html_form += "<div><p>Categories:<br>\n";
			for ( category in BRS.categs ) {
				html_form += "<label class='ialign'><input type='checkbox' value='" + category + "'/>" + BRS.categs[category] + "</label><br>\n";
			}
			html_form += "</p></div>";

			html_form += "<p id='warn'></p>" +
				"<p><input id='sug_feature' type='hidden' value='" + type + "'><input type='button' class='ialign' value='Submit suggestion' onclick='BRS.comment(\"" + shape_id + "\", \"" + str_coords + "\")'/></p>" +
		"</form>&nbsp;";

			// put window at center for info
			//L.popup().setLatLng(centre).setContent("I am a standalone popup.").openOn(BRS.map);
			BRS.shape.bindPopup(html_form).openPopup();

			// focus on the first field of the form
			$('#sug_name').focus();

			// turn off the feature button, need to click it again to create a new shape
			BRS.set_mode('map');
		}
	);

	// load data
	BRS.get_list(true);
};

// button clicks determine the mode
BRS.set_mode = function(m) {
	// remove the active styling of both buttons
	$('#acbut_point').removeClass('button_active');
	$('#acbut_line').removeClass('button_active');
	$('#acbut_poly').removeClass('button_active');

	// if drawing mode is activated, deactivate it.
	if ( BRS.active_shape ) {
		BRS.active_shape.disable();
	}

	// if the user turned off the button, go back to map mode
	if ( m === BRS.mode || m === 'map' ) {
		BRS.mode = 'map';
		$('#map').css('cursor', '');
		return;
	}

	// remove any existing, unfinished shapes
	if ( BRS.shape ) {
		BRS.map.removeLayer(BRS.shape);
	}

	// user turned on a button
	BRS.mode = m;
	$('#acbut_' + m).addClass('button_active');
	$('#map').css('cursor', 'crosshair');

	// initialize drawing mode of appropriate type
	if ( m === 'point') {
		BRS.active_shape = new L.Draw.Marker(BRS.map,
			{ allowIntersection: false,
			showArea: true,
			drawError: { color: '#b00b00', timeout: 1000 } } );
	}
	if ( m === 'line' ) {
		BRS.active_shape = new L.Draw.Polyline(BRS.map,
			{ //allowIntersection: false,
			showArea: true,
			drawError: { color: '#b00b00', timeout: 1000 },
			shapeOptions: { color: 'blue', weight: 8 } } );
	}
	if ( m === 'poly' ) {
		BRS.active_shape = new L.Draw.Polygon(BRS.map, 
			{ //allowIntersection: false,
			showArea: true,
			drawError: { color: '#b00b00', timeout: 1000 },
			shapeOptions: { color: 'blue', weight: 8 } } );
	}
	BRS.active_shape.enable();
};

// ajax load list of data
BRS.get_list = function( initialization_bool ) {
	var comments_array, com, support_comments, cmts_string, support, coords, llarray, title, support_form, mfo, cat_array, categories, html_string, table_string,
		url = window.location.href,
		url_dict, url_parts, url_part,
		f_num;

	// get list of suggested locations
	$.ajax({
		url: "data/coms.json",
		cache: false,
		success: function( jdata ) {

			// copy to global object
			BRS.features = jdata['cycling_comments'];

			// iterate through comments
			for ( com_num in jdata['cycling_comments'] ) {

				// overwrite index with object
				com = jdata['cycling_comments'][com_num];
				cmts_array = com.support_comments;
				cmts_string = ''

				// if there are comments build a text string of them
				if ( cmts_array.length > 0 ) {
					// Build window components
					cmts_string = '<h4>Comments:</h4>';

					// iterate through comments
					for ( support in cmts_array ) {

						// overwrite index with object
						support = cmts_array[support];

						// build string of comments
						cmts_string += "<b>" + support.name + "</b> \"" + support.com + "\"<br>\n";
					}
				}

				// create list of categories this belongs to
				categories = '';
				cat_array = com['category'].split(',');

				// get array of categories that we are in
				for ( c in cat_array ) {
					categories += BRS.categs[cat_array[c]] + ', ';
				}
				categories = categories.replace(/(, )$/g,'');

				// build html
				title = '<h3>' + com['title'] + 
					" <img onclick=\"window.prompt('Copy to clipboard: Ctrl+C, Enter', '" + window.location.href.split('?')[0] + "?feature=" + com['id'] + "');\" src='imgs/link.png' title='Get link to this feature'>\n" +
					"<img onclick=\"$('#support_form').show()\" src='imgs/add_comment.png' title='Add a comment'></h3>\n" +
					'<h4>Location type: ' + categories + '</h4>\n' +
					'<p><strong>' + com['name'] + '</strong>: ' + com['com'] + '</p>\n';

				// build the form for comments/votes
				support_form = "<div id='support_form' style='display:none'>" +
					"<h3>Add comment</h3>" +
					"<form>" +
						"<p>Your name: <input id='sup_name' class='ialign' type='text'/></p>" +
						"<div style='height: 5em;'><p>Comment: <textarea id='sup_com' class='ialign' type='text'></textarea></p></div>" +
						"<p id='warn'></p>" +
						"<p><input type='button' class='ialign' value='Submit comment' onclick='BRS.support(\"" + com['id'] + "\")'/></p>" +
					"</form>&nbsp;" +
					"</div>";

				// get coords and convert to latLng objects
				coords = com['coords'].split(' ');
				llarray = [];
				for ( c in coords ) {
					llarray.push(L.latLng(coords[c].split(',')));
				}

				// add the markers/polyline/polygon
				if ( com['feature'] === 'marker' ) {
					mfo = {marker: L.marker(coords[0].split(',')).bindPopup(title + cmts_string + support_form)};
				}
				if ( com['feature'] === 'polyline' ) {
					mfo = {marker: L.polyline(llarray, {weight: 8}).bindPopup(title + cmts_string + support_form)};
				}
				if ( com['feature'] === 'polygon' ) {
					mfo = {marker: L.polygon(llarray, {weight: 8}).bindPopup(title + cmts_string + support_form)};
				}
				// save objects, and add to map
				mfo.mapped = mfo.marker.addTo(BRS.map);
				BRS.mapped_features.push(mfo);
			}

			// Populate the category selections in the options panel
			html_string = '';
			for ( cat in BRS.categs ) {
				// cat is the short name
				html_string += "<label><input type='checkbox' value='" + cat + "' checked onclick='BRS.display_data()'/>" + BRS.categs[cat] + "</label><br>\n";
			}
			html_string += "Search <input id='text_search' type='text'>\n";

			// add to options panel
			$('#sel_options_cont').html(html_string);

			// display the tabular data and update map feature visibility
			BRS.display_data();

			// initialize the text search
			$('#text_search').on('change keydown paste input', BRS.display_data);

			// check if the url contains a reference to a feature
			url_parts = url.split('?');
			if ( initialization_bool && url_parts.length > 1 ) {
				// look for 'feature=#.##,#.##'
				// it must be the first and only variable passed
				url_part = url_parts[1].split('=');

				if ( url_part[0] === 'feature' ) {
					// go to feature with id url_part[1]
					for ( f_num in BRS.features ) {
						console.log(BRS.features[f_num].id + ' ' + url_part[1]);
						if ( BRS.features[f_num].id === url_part[1] ) {
							BRS.pan_open(f_num);
							break;
						}
					}
				}
			}
		}
	});
};

// display markers and options panel data
BRS.display_data = function () {
	// create a local version of the global BRS.features object
	var feat = BRS.features,
		f,
		f_num,
		check_boxes = $('#sel_options_cont input[type=checkbox]'),
		cbl = check_boxes.length,
		chkbx,
		cat, fcat, fcats, display,
		supcoms, sc,
		linelen,
		categories = [],
		srch_supcoms = '',
		srch = $('#text_search').val(),
		re = new RegExp(srch, 'i'),
		table_string = '';

	// get an array of just the checked boxes
	for( chkbx = 0; chkbx < cbl; chkbx = chkbx + 1) {
		if ( check_boxes[chkbx].checked ) {
			categories.push(check_boxes[chkbx].value);
		}
	}

	// go through each feature
	for ( f_num in feat ) {
		f = feat[f_num];

		// check if any of this feature's categories match those selected for viewing
		display = false;
		srch_supcoms = '';

		// find if each feature matches any of the categories to display
		for ( cat in categories ) {
			fcats = f.category.split(',');
			for ( fcat in fcats ) {
				//console.log(fcats[fcat] + ' ' + categories[cat]);
				if ( fcats[fcat] === categories[cat] ) {
					display = true;
					break;
				}
			}

			if ( display ) {


				break;
			}
		}

		// check if the search has anything and it matches
		if ( display ) {

			if ( srch === '' ) {
				// do nothing, set back display to true
			} else {
				// set display back to false
				display = false;

				// go through the comments on this feature and build a big string
				supcoms = f['support_comments'];
				for ( sc in supcoms ) {
					// build up a comments string for search, used later
					srch_supcoms  += supcoms[sc].name + ' ';
					srch_supcoms  += supcoms[sc].com + ' ';
				}

				// test if any of the components contain the search string
				if ( re.test(f['title']) || re.test(f['name']) || re.test(f['com']) || re.test(srch_supcoms) ) {
					// set display to true if we match
					display = true;
				}
			}
		}

		// now do whatever depending on whether we display it or not
		if ( display ) {
			// format comment, in case of over length
			sc = f['com'];
			linelen = f['com'].length + f['name'].length + f['title'].length;
			
			if ( linelen > 50 ) {
				sc = f['com'].substr(0, 50 - f['name'].length - f['title'].length).replace(/\s$/, '') + '...';
			}
			
			// uncapitalize all text in comment except starting Letter
			sc = sc.substr(0,1).toUpperCase() + sc.substr(1).toLowerCase();

			// Populate the contents of the table in the options panel
			table_string += "<span class='table_feature'>" + f['title'] + " <small>by <strong>" + f['name'] + "</strong></small> \"" +
				sc + "\" " + 
				"<div><span onclick='BRS.pan_open(\"" + f_num + "\")'><img src='imgs/reticule.png'></span>" +
				"<span class='cmnt_symb'>" + f.support_comments.length + "</span></div></span>\n";

			// display the markers
			BRS.mapped_features[f_num].mapped = BRS.mapped_features[f_num].marker.addTo(BRS.map);
		} else {
			// hide the marker
			BRS.map.removeLayer(BRS.mapped_features[f_num].mapped);
		}
	}

	// add to the table
	$('#table_view_cont').html(table_string);
}

// Pan to and open popup
BRS.pan_open = function(fid) {
	// get the lat/lng or center lat/lng depending on type
	if ( BRS.features[fid].feature === 'marker' ) {
		BRS.map.panTo( BRS.mapped_features[fid].mapped.getLatLng() );
	} else {
		BRS.map.panTo( BRS.mapped_features[fid].mapped.getBounds().getCenter() );
	}
	// open the popup
	BRS.mapped_features[fid].mapped.openPopup();
}

// remove all features from the list
BRS.remove_features = function() {
	for ( f in BRS.mapped_features ) {
		BRS.map.removeLayer(BRS.mapped_features[f].mapped);
	}
	BRS.mapped_features = [];
}

// someone is submitting a new infr/maint/ect... feature form
BRS.comment = function( latlng_id, coordinates ) {
	var check_boxes, cbl, chkbx, categories = [];

	// get all the checkbox elements
	check_boxes = $('form input[type=checkbox]');
	cbl = check_boxes.length
	
	// get the checked checkboxes
	for( chkbx = 0; chkbx < cbl; chkbx = chkbx + 1) {
		if ( check_boxes[chkbx].checked ) {
			categories.push(check_boxes[chkbx].value);
		}
	}

	// send data
	$.ajax({
		url: "pinc/sub_com.php",
		type: "POST",
		data: {
			name: $('#sug_name').val(),
			title: $('#sug_title').val(),
			comment: $('#sug_com').val(),
			category: categories.toString(),
			feature: $('#sug_feature').val(),
			id: latlng_id,
			coords: coordinates
		},
		success: function( data ) {
			if ( data == "Success!" ) {
				// close the popup window
				BRS.shape.closePopup();

				// remove the shape from the map, it will be reloaded with all the others
				BRS.map.removeLayer(BRS.shape);
				BRS.remove_features();

				// relaod all features
				BRS.get_list( false );
			} else {
				$( "#warn" ).html( "<strong>" + data + "</strong>");
			}
		}
	});
};

// form for support of existing comment - submit calls this
BRS.support = function( id ) {

	// send data to server
	$.ajax({
		url: "pinc/sub_sup.php",
		data: {
			name: $('#sup_name').val(),
			comment: $('#sup_com').val(),
			id: id
		},
		success: function( data ) {
			if ( data == "Success!" ) {
				// close the popup window
				BRS.map.closePopup();

				// reload map features and comments
				BRS.remove_features();
				BRS.get_list( false );
			} else {
				$( "#warn" ).html( "<strong>" + data + "</strong>");
			}
		}
	});
};

// show/hide zoom warning message
BRS.zoomLock = function( e ) {
	if ( BRS.map.getZoom() >= BRS.config.zoom_edit_level ) {
		// enable editing buttons
		$('#zoom_in_text').hide();
		$('#action_buttons').show();
	} else {
		// hide editing buttons
		$('#zoom_in_text').show();
		$('#action_buttons').hide();
		BRS.set_mode('map');
	}
};

// convert different shape objects to string format
BRS.coords_to_string = function( c , sep) {
	var i, build_up = '';

	// check if this object has lat and long
	if ( c.lat && c.lng ) {
		// marker
		return( c.lat + sep + c.lng);
	}

	// go through each latlng object in array and extract lat/lng as strings (recursively)
	for ( i = 0; i < c.length; i = i + 1 ) {
		build_up += BRS.coords_to_string( c[i], sep ) + ' ';
	}
	// return coords without last space
	return( build_up.trim() );
};

// miscellaneous minor functions
BRS.toggle_footer = function(elem) {
	if ( elem.id === 'fclosed' ) {
		$(elem).hide();
		$('#fopened').show();
		$('#footer').animate({'height': '300px'}, 200, function() { $('#options_panel').show(); } );
	} else {
		$(elem).hide();
		$('#fclosed').show();
		$('#options_panel').hide();
		$('#footer').animate({'height': '23px'}, 200);
	}
};

window.onload = BRS.init;

// end of file brs.js
