/**
 * Test loader plugin
 */

define(['module'], function() {

	'use strict';

	return {
		load: function(name, req, onLoad, config) {
			if(config.isBuild) {
				onLoad();
				return;
			}
			var test = window.DeviceOrientationEvent;
			if(test) {
				req([name], function(value) {
					onLoad(value);
				});
			} else {
				onLoad();
			}
		}
	};

});

