var Mondb = require('mondb');

function PersistentTimeSeries(type) {
};

PersistentTimeSeries.prototype.tick = function (t, x) {
	
};

exports.persist = function (mdb, db, user) {
	mdb.hookSeriesCreate = function (seriesKey, server, service) {
		return new Mondb.CachingTimeSeries(new PersistentTimeSeries(user, server.id, seriesKey));
	};
};
