var Mondb = require('mondb');

function CoTimeSeries(user, serverId, seriesKey) {
	this.cache = new Mondb.TimeSeries(Mondb.seriesTypes["sec150"].name);
	this.persistent = new PersistentTimeSeries(user, serverId, seriesKey);
};

CoTimeSeries.prototype.load = function (data) {
	this.cache.load(data);
};

CoTimeSeries.prototype.tick = function (t, x) {
	this.cache.tick(t, x);
	this.persistent.tick(t, x);
};

CoTimeSeries.prototype.cull = function () {
	this.cache.cull();
};

CoTimeSeries.prototype.getRange = function (from, to) {
	this.cache.getRange(from, to);
};

CoTimeSeries.prototype.getCacheData = function () {
	this.cache.getCacheData();
};

function PersistentTimeSeries(type) {
};

PersistentTimeSeries.prototype.tick = function (t, x) {

};

exports.persist = function (mdb, db, user) {
	mdb.hookSeriesCreate = function (seriesKey, server, service) {
		return new CoTimeSeries(user, server.id, seriesKey);
	};
};
