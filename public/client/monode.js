$((function () {
	var Monode = window["Monode"] = {};

	if (!window.console) {
		window.console = {log: function () {}, error: function () {}};
	}
	if (!console.exception) {
		console.exception = console.error;
	}

	var config = Monode.config = {};
	var db = Monode.db = null;

	var serverlistEl;
	var serverlistOverviewEl;
	var mainEl;
	var alertlistEl;

	function init() {
		serverlistEl = $('#serverlist');
		serverlistOverviewEl = $('#serverlist_overview');
		mainEl = $('#main');
		alertlistEl = $('#alertlist');
		$.ajax({
			url: '/config.json',
			dataType: 'json',
			success: function (data) {
				$.extend(Monode.config, data);
				start();
			}
		});

		serverlistEl.find('li.overview').click(function () {
			Monode.showPage('overview');
		});

		serverlistEl.find('li.settings').click(function () {
			Monode.showPage('settings');
		});
	};

	function start() {
		var socket = new io.Socket(null, {port: config.port});
		socket.on('connect', function(){
		});
		socket.on('message', function(data){
			Monode.handleMessage($.parseJSON(data));
		});
		socket.on('disconnect', function(){});
		socket.connect();
	};

	Monode.currentPage = 'overview';

	Monode.showPage = function (pagename) {
		mainEl.children('.page').hide();
		$('#'+pagename).show();

		Monode.currentPage = pagename;

		if (pagename == "overview") {
			serverlistEl.addClass('overview-mode');
		} else {
			serverlistEl.removeClass('overview-mode');
		}

		Monode.updatePage();
	};

	Monode.pageUpdateInterval = 1500;
	Monode.pageUpdateTimer = null;
	Monode.updatePage = function () {
		if (Monode.pageUpdateTimer) {
			clearTimeout(Monode.pageUpdateTimer);
		}

		var pageEl = $("#"+Monode.currentPage);

		if (Monode.currentPage == "overview") {
			var data = [];
			for (var i in Monode.db.db.server) {
				var timeseries;
				if (timeseries = Monode.db.series[i+'-cpuusr']) {
					var endTime = (new Date()).getTime();
					var startTime = endTime - 90000;

					data.push(timeseries.getRange(startTime));
				}
			}
			$.plot('#overview_graph', data, Monode.overviewGraphOptions);
		} else if (Monode.currentPage.substr(0, 11) == "serverpage-") {
			var server = Monode.db.getServer(Monode.currentPage.substr(11));
			var serverStatus = Monode.db.getServerStatus(server);

			pageEl.removeClass("notok ok").addClass(serverStatus);

			var uptimeEl = pageEl.find(".properties .uptime");
			uptimeEl.text(server.uptime);
		}

		Monode.pageUpdateTimer =
			setTimeout(arguments.callee, Monode.pageUpdateInterval);
	};

	Monode.openServerPage = function (serverId) {
		var serverPage = $('#serverpage-'+serverId);

		if (!serverPage.length) {
			Monode.createServerPage(serverId);
		}
		Monode.showPage('serverpage-'+serverId);

		Monode.updatePage();
	};

	Monode.createServerPage = function (serverId) {
		var server = Monode.db.getServer(serverId);

		var data = {
			server: server
		};

		serverPage = $('<div/>');
		serverPage.attr('id', 'serverpage-'+serverId);
		serverPage.addClass('page serverpage');

		var html = new EJS({url: 'templates/serverpage.ejs'}).render(data);
		serverPage.html(html);

		serverPage.appendTo(mainEl);

		serverPage.find(".service .title").click(function () {
			var titleEl = $(this);
			var bodyEl = titleEl.parent().find('.body');

			if (bodyEl.is(":visible")) {
				titleEl.parent().removeClass("expanded");
				bodyEl.slideUp("fast");
			} else {
				titleEl.parent().addClass("expanded");
				bodyEl.slideDown("fast");
			}
		});
	};

	Monode.overviewGraphOptions = {
		series: {
			lines: { show: true },
			points: { show: false }
		},
		legend: {
			show: true
		},
		xaxis: {
			tickFormatter: function (data) {
				return new Date(data).format('d-m-Y H:i:s');
			}
		},
		yaxis: {
			max: 100
		},
		grid: {
			backgroundColor: { colors: ["#fff", "#eee"] }
		}
	};

	Monode.overviewSparklinesOptions = {
		series: {
			color: '#eee',
			lines: {
				lineWidth: 0.8,
				fill: true,
				fillColor: '#555'
			},
			shadowSize: 0
		},
		xaxis: {
	    },
		yaxis: {
			min: 0,
			max: 100
		},
	    grid: {
			show: false
	    }
	};
	Monode.drawOverviewSparkline = function (container, data, extraOptions) {
		var graphOptions = $.extend(true, {}, Monode.overviewSparklinesOptions);
		var graph = $('<div/>')
			.appendTo(container)
		;

		$.plot(graph, data, graphOptions);
	};

	Monode.setupMondbEvents = function (db) {
		db.onserveradd = function (server) {
			var serverEl = $('<li/>')
				.attr('id', 'server-'+server.id)
				.addClass('server ok awesome')
			;
			serverEl.append(
				$('<div class="status"/>')
					.append('<div/>')
					.find('div')
					.css('opacity', 0)
					.end()
			);
			serverEl.append($('<div class="alias"/>').text(server.hostname));
			serverEl.appendTo(serverlistEl);
			serverEl.click(function () {
					Monode.openServerPage(server.id);
			});

			var serverOverviewEl = $('<li/>')
				.attr('id', 'server-overview-'+server.id)
				.addClass('server')
			;
			serverOverviewEl.appendTo(serverlistOverviewEl);
		};
		db.onserverchange = function (server) {
			var serverEl = $('#server-'+server.id);
			serverEl.find('.status div')
				.stop()
				.css('opacity', 1)
				.animate({
					opacity: 0
				}, 400);
			;
		};
		db.onserviceadd = function (service, server) {
			var serverOverviewEl = $('#server-overview-'+server.id);
			var serviceEl = $('<div/>');

			serviceEl.addClass("service");
			serviceEl.attr('data-name', service.name);

			if (service.type == 5) {
				serviceEl.text('System');
				serverOverviewEl.prepend(serviceEl);
				var cpuGraph = $('<div/>')
					.addClass("cpu graph")
					.appendTo(serviceEl)
					.text('CPU')
				;
				var memGraph = $('<div/>')
					.addClass("mem graph")
					.appendTo(serviceEl)
					.text('Mem')
				;
			} else if (service.type == 3) {
				serviceEl.text(service.name);
				serverOverviewEl.append(serviceEl);
			}

			this.onservicechange(service, server);
		};
		db.onservicechange = function (service, server) {
			console.log("onservicechange", service);
			var serverOverviewEl = $('#server-overview-'+server.id);
			var serviceEl = serverOverviewEl.find('[data-name="'+service.name+'"]');

			if (service.type == 5) {
				serviceEl.find('.graph div').remove();

				var endTime = service.updated;
				var startTime = endTime - 90000;

				// CPU sparkline
				var cpuSysData = {
					stack: 0,
					data: Monode.db
						.getSeries('cpusys', server, service)
						.getRange(startTime),
					lines: {
						lineWidth: 0,
						fillColor: "#777"
					}
				};
				var cpuUsrData = {
					stack: 0,
					data: Monode.db
						.getSeries('cpuusr', server, service)
						.getRange(startTime),
					lines: {
						fillColor: "#555"
					}
				};
				var cpuRedDot = {
					stack: 0,
					data: [ [ cpuSysData.data[cpuSysData.data.length - 1][0], 0 ] ],
					lines: {
						show: false
					},
					points: {
						show: true,
						radius: 1,
						fillColor: '#ff0000'
					},
					color: '#ff0000'
				};

				if (cpuUsrData.data.length > 2) {
					Monode.drawOverviewSparkline(
						serviceEl.find('.graph.cpu'),
						[cpuSysData, cpuUsrData, cpuRedDot], {
							xaxis: {
								min: startTime,
								max: endTime
							}
						}
					);
				}

				// Memory sparkline
				var memData = Monode.db
					.getSeries('mempct', server, service)
					.getRange(startTime);

				var memRedDot = {
					data: [ memData[memData.length - 1] ],
					lines: {
						show: false
					},
					points: {
						show: true,
						radius: 1,
						fillColor: '#ff0000'
					},
					color: '#ff0000'
				};

				if (memData.length > 2) {
					Monode.drawOverviewSparkline(
						serviceEl.find('.graph.mem'), [memData, memRedDot], {
							xaxis: {
								min: startTime,
								max: endTime
							}
						}
					);
				}
			}

			serviceEl.addClass(Math.round(service.status) == 0 ? "ok" : "notok");
		};
		db.onmonevent = function (event) {
			console.log("onmonevent", event);
			var alertEl = $('<li/>');
			alertEl.append(
				$('<span/>')
					.addClass('server')
					.text(Monode.db.getServer(event.server).hostname)
			);
			alertEl.append(
				$('<span/>')
					.addClass('service')
					.text(event.service)
			);
			alertEl.append(
				$('<span/>')
					.addClass('message')
					.text(event.message)
			);
			alertEl.prependTo(alertlistEl);
		};
		db.onmoneventclear = function () {
			alertlistEl.empty();
		};
	};

	Monode.handleMessage = function (message) {
		console.log(message);
		try {
			switch (message[0]) {
			case 'initial':
				if (!db) db = Monode.db = Mondb.create();
				Monode.setupMondbEvents(db);
				db.load(message[1]);
				Monode.updatePage();
				break;

			case 'heartbeat':
				if (!db) Monode.error("No initial state transferred.");
				db.parseHeartbeat(message[1]);
				break;

			default:
				Monode.error("Invalid message " + message.toString());
			}
		} catch (e) {
			console.error(e);
			console.info("Message was ", message);
		}
	};

	Monode.error = function (message) {
		if ("object" == typeof console && console.error) console.error(message);
	};

	return init;
})());
