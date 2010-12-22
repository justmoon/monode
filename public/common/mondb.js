(function (Mondb){
	var isArray = Array.isArray ? Array.isArray : function (s) {
		return Object.prototype.toString.call(s) === '[object Array]';
	};

	var enforceArray = function (s) {
		return s && "undefined" != typeof s.length ? s :
			"undefined" == typeof s ? [] : [s];
	};

	var Database = Mondb["Database"] = function ()
	{
		this.db = {server:{},event:[]};
		this.series = {};
	};

	Mondb.create = function ()
	{
		return new Database();
	};

	/**
	 * Mondb settings.
	 */
	var s = Mondb.settings = {};

	/**
	 * Downtime grace factor.
	 *
	 * This factor denotes how many times the poll period we will wait before
	 * considering the host down.
	 */
	s.graceFactor = 2;

	/**
	 * Time offset.
	 *
	 * Because Mondb is run distributedly, the server and client times may differ.
	 * Therefore, we send the time with every update and maintain an offset on
	 * the client to account for this.
	 */
	s.timeCorrection = 0;

	Mondb.getTime = function ()
	{
		return new Date().getTime() + s.timeCorrection;
	};

	Database.prototype.load = function (db)
	{
		var i, j;

		// Pre-copy events
		for (i in this.db.server) {
			this.onserverremove(this.db.server[i]);
			delete this.db.server[i];
		}

		// Copy data object over in one go
		this.db = db;

		// Read series cache
		console.log(this.db.seriesCache);
		for (i in this.db.seriesCache) {
			this.series[i] = new TimeSeries(seriesTypes["sec150"]);
			this.series[i].store = this.db.seriesCache[i];
		}
		delete this.db.seriesCache;

		// Post-copy events
		for (i in this.db.server) {
			this.onserveradd(this.db.server[i]);

			for (j in this.db.server[i].service) {
				this.onserviceadd(this.db.server[i].service[j], this.db.server[i]);
			}
		}

		this.repopulateMonEvents();
	};

	Database.prototype.repopulateMonEvents = function ()
	{
		this.onmoneventclear.call(this);

		for (i = 0; i < this.db.event.length; i++) {
			this.onmonevent.call(this, this.db.event[i]);
		}
	};

	Database.prototype.serialize = function ()
	{
		this.db.seriesCache = {};

		for (var i in this.series) {
			var cache = this.series[i].getCacheData();
			if (cache) this.db.seriesCache[i] = cache;
		}

		return this.db;
	};

	Database.prototype.parseHeartbeat = function (hb)
	{
		var version = "undefined" == typeof hb["@"] ? 1 : 2;

		var self = this;

		function applyHeartbeat(server, hb)
		{
			server.incarnation = version == 2 ? hb["@"].incarnation : hb.server.incarnation;
			server.poll = parseInt(hb.server.poll);
			server.startdelay = parseInt(hb.server.startdelay);
			server.hostname = hb.server.localhostname;
			server.controlfile = hb.server.controlfile;
			server.monitUptime = parseInt(hb.server.uptime);

			// Process downtime
			var latestDowntime = ServerDressing.prototype.getDowntime.apply(server);
			if (latestDowntime != server.downtime) {
				server.downtime = latestDowntime;
				server.upSince = Mondb.getTime();
			}
			server.lastseen = Mondb.getTime();

			var services = enforceArray(version == 2 ? hb.services.service : hb.service);

			for (var i = 0; i < services.length; i++) {
				var service;
				if ("undefined" == typeof (service = server.service[services[i].name])) {
					service = server.service[services[i].name] = {series:{}};
					service.name = version == 2 ? services[i]["@"].name : services[i].name;
					applyServiceHeartbeat(service, server, services[i]);
					self.onserviceadd.call(self, service, server);
				} else {
					applyServiceHeartbeat(service, server, services[i]);
					self.onservicechange.call(self, service, server);
				}
			}

			var servicegroups = enforceArray(version == 2 ? hb.servicegroups.servicegroup : hb.servicegroup);

			for (var i = 0; i < services.length; i++) {
				applyServicegroupHeartbeat(server, servicegroups[i]);
			}

			if ("undefined" != typeof hb.event) {
				applyEventHeartbeat(server, hb.event);
			}
		};

		function applyServiceHeartbeat(service, server, svchb)
		{
			service.status = parseInt(svchb.status);
			service.type = parseInt(version == 2 ? svchb.type : svchb["@"].type);
			service.updated = parseInt(svchb.collected_sec)*1000 + Math.round(svchb.collected_usec/1000);

			switch (service.type) {
			case 0: // TYPE_FILESYSTEM
				break;

			case 1: // TYPE_DIRECTORY
				break;

			case 2: // TYPE_FILE
				break;

			case 3: // TYPE_PROCESS
				break;

			case 4: // TYPE_HOST
				break;

			case 5: // TYPE_SYSTEM
				self.getSeries('cpuusr', server, service)
					.tick(service.updated, parseFloat(svchb.system.cpu.user));
				self.getSeries('cpusys', server, service)
					.tick(service.updated, parseFloat(svchb.system.cpu.system));
				self.getSeries('cpuio', server, service)
					.tick(service.updated, parseFloat(svchb.system.cpu.wait));
				self.getSeries('loadavg01', server, service)
					.tick(service.updated, parseFloat(svchb.system.load.avg01));
				self.getSeries('loadavg05', server, service)
					.tick(service.updated, parseFloat(svchb.system.load.avg05));
				self.getSeries('loadavg15', server, service)
					.tick(service.updated, parseFloat(svchb.system.load.avg15));
				self.getSeries('mempct', server, service)
					.tick(service.updated, parseFloat(svchb.system.memory.percent));
				self.getSeries('memkb', server, service)
					.tick(service.updated, parseFloat(svchb.system.memory.kilobyte));
				if ("undefined" != typeof svchb.system.swap) {
					self.getSeries('swppct', server, service)
						.tick(service.updated, parseFloat(svchb.system.swap.percent));
					self.getSeries('swpkb', server, service)
						.tick(service.updated, parseFloat(svchb.system.swap.kilobyte));
				}
				break;

			case 6: // TYPE_FIFO
				break;

			case 7: // TYPE_STATUS
				break;
			}
		};

		function applyServicegroupHeartbeat(server, svcghb)
		{

		};

		function applyEventHeartbeat(server, evthb)
		{
			var event = evthb;
			event.server = server.id;
			event.id = parseInt(event.id);
			event.state = parseInt(event.state);
			event.type = parseInt(event.type);
			event.collected_sec = parseInt(event.collected_sec);
			event.collected_usec = parseInt(event.collected_usec);
			event.action = parseInt(event.action);
			self.db.event.push(event);
			self.onmonevent.call(this, event);
		};

		var server;
		if ("undefined" == typeof (server = this.db.server[hb.server.id])) {
			server = this.db.server[hb.server.id] = {service: {}};
			server.id = version == 2 ? hb["@"].id : hb.server.id;
			server.platform = hb.platform;
			server.platform.cpu = parseInt(server.platform.cpu);
			server.downtime = 0;
			server.lastseen = Mondb.getTime();
			server.knownSince = Mondb.getTime();
			applyHeartbeat(server, hb);
			this.onserveradd.call(this, server);
		} else {
			applyHeartbeat(server, hb);
			this.onserverchange.call(this, server);
		}
	};

	/**
	 * Send a tick to a time series.
	 *
	 * This function is specifically intended to be monkey patched to change
	 * its behavior.
	 */
	Database.prototype.getSeries = function (seriesKey, server, service) {
		// By default, we cache the last 150 seconds of any time series.
		if ("undefined" == typeof this.series[server.id+"-"+seriesKey]) {
			this.series[server.id+"-"+seriesKey] = this.hookSeriesCreate(seriesKey, server, service);
		}

		return this.series[server.id+"-"+seriesKey];
	};

	Database.prototype.onserveradd = function (server) {};
	Database.prototype.onserverchange = function (server) {};
	Database.prototype.onserverremove = function (server) {};
	Database.prototype.onserviceadd = function (service, server) {};
	Database.prototype.onservicechange = function (service, server) {};
	Database.prototype.onmonevent = function (server) {};
	Database.prototype.onmoneventclear = function (server) {};

	Database.prototype.hookSeriesCreate = function (seriesKey, server, service) {
		return new TimeSeries(seriesTypes["sec150"]);
	};

	Database.prototype.getServer = function (serverId) {
		return this.db.server[serverId];
	};

	Database.prototype.getServerStatus = function (server) {
		var ok = true;

		for (var i = 0; i < server.service.length; i++) {
			if (server.service[i].status != 0) {
				ok = false;
			}
		}

		return ok ? "ok" : "notok";
	};

	var seriesTypes = Mondb["seriesTypes"] = {
		"sec150": {
			name: 'sec150',
			maxAge: 150000,
			minDelta: 1900
		},
		"hour": {
			name: 'hour',
			maxAge: 3600000,
			minDelta: 9000
		},
		"day" : {
			name: 'day',
			maxAge: 86400000,
			minDelta: 216000
		},
		"month" : {
			name: 'month',
			maxAge: 2678400000,
			minDelta: 6696000
		},
		"year" : {
			name: 'year',
			maxAge: 31536000000,
			minDelta: 78840000
		}
	};

	var TimeSeries = Mondb["TimeSeries"] = function TimeSeries(type) {
		this.store = [];
		this.type = type.name;
		this.maxAge = type.maxAge;
		this.minDelta = type.minDelta;
	};

	TimeSeries.prototype.load = function (data) {
		this.store = data;
	};

	TimeSeries.prototype.tick = function (t, x) {
		if (this.store.length &&
			(t - this.store[this.store.length-1][0]) < this.minDelta) return;

		this.store.push([t, x]);

		this.cull();
	};

	TimeSeries.prototype.cull = function () {
		var cutoff = (new Date().getTime()) - this.maxAge;
		while (this.store.length) {
			if (this.store[0][0] < cutoff) {
				this.store.shift();
			} else {
				return;
			}
		}
	};

	TimeSeries.prototype.getRange = function (from, to, callback) {
		var i, firstIndex, lastIndex;

		if (!this.store.length) return [];

		if (from) {
			for (i = 0; i < this.store.length; i++) {
				if (this.store[i][0] > from) {
					firstIndex = i;
					break;
				}
			}
			if ("undefined" == typeof firstIndex) return [];
		} else {
			firstIndex = 0;
		}

		if (to) {
			for (i = firstIndex; i < this.store.length; i++) {
				if (this.store[i][0] > to) {
					lastIndex = i-1;
					break;
				}
			}
			lastIndex = this.store.length-1;
		} else {
			lastIndex = this.store.length-1;
		}

		callback(this.store.slice(firstIndex, lastIndex));
	};

	TimeSeries.prototype.getCacheData = function () {
		return this.store;
	};

	var NullTimeSeries = Mondb["NullTimeSeries"] = {
		load: function (data) {},
		tick: function (t, x) {},
		cull: function () {},
		getRange: function (from, to, callback) {callback([]);}
	};

	var CachingTimeSeries = Mondb.CachingTimeSeries = function CachingTimeSeries(backend) {
		this.cache = new Mondb.TimeSeries(Mondb.seriesTypes["sec150"].name);
		this.persistent = backend;
	};

	CachingTimeSeries.prototype.load = function (data) {
		this.cache.load(data);
	};

	CachingTimeSeries.prototype.tick = function (t, x) {
		this.cache.tick(t, x);
		this.persistent.tick(t, x);
	};

	CachingTimeSeries.prototype.cull = function () {
		this.cache.cull();
	};

	CachingTimeSeries.prototype.getRange = function (from, to, callback) {
		this.cache.getRange(from, to, callback);
	};

	CachingTimeSeries.prototype.getCacheData = function () {
		return this.cache.getCacheData();
	};

	var ServerDressing = Mondb["ServerDressing"] = function () {};

	ServerDressing.prototype.getDowntime = function () {
		if ((Mondb.getTime() - this.lastseen) >
			(this.poll * 1000 * s.graceFactor)) {
			return this.downtime + Mondb.getTime() - this.lastseen;
		} else {
			return this.downtime;
		}
	};

})(typeof exports === 'undefined' ? (this["Mondb"]={}) : exports);

