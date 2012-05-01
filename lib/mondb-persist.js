var Mondb = require('../public/common/mondb');

var mongoose = require('mongoose');
var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var persistentTypes = [
  'day', 'month', 'year'
];

exports.persist = function (mdb, db, user) {
  var TimeSeriesRecord = new Schema({
    user: ObjectId,
    server: String,
    series: String,
    type: String,
    data: String,
    firstTick: Number,
    lastTick: Number
  });

  function PersistentTimeSeries(user, serverId, seriesKey) {
    this.user = user;
    this.serverId = serverId;
    this.seriesKey = seriesKey;
  };

  PersistentTimeSeries.prototype.tick = function (t, x) {
    var i;
    var self = this;

    TimeSeriesRecord.find({
      user: this.user,
      server: this.serverId,
      series: this.seriesKey
    }).all(function (result) {
      var byType = {};
      for (i in result) {
        byType[result[i].type] = result[i];
      }

      var now = new Date().getTime();
      for (i in persistentTypes) {
        var type = persistentTypes[i];
        if ("undefined" == typeof byType[type]) {
          byType[type] = new TimeSeriesRecord({
            user: self.user,
            server: self.serverId,
            series: self.seriesKey,
            type: type,
            data: [],
            firstTick: now,
            lastTick: 0
          });
        }

        if (byType[type].lastTick < (now - Mondb.seriesTypes[type].minDelta)) {
          console.log('tick', type, now - byType[type].lastTick.toNumber(), Mondb.seriesTypes[type].minDelta);
          byType[type].data.push([t, x]);
          byType[type].lastTick = new Date().getTime();
        }

        while (byType[type].data.length && byType[type].data[0][0] <
             (now - Mondb.seriesTypes[type].maxAge)) {
          console.log('cull', type, now - byType[type].data[0][0], Mondb.seriesTypes[type].maxAge);
          byType[type].data.shift();
        }

        byType[type].save();
      }
    });
  };

  mdb.hookSeriesCreate = function (seriesKey, server, service) {
    return new Mondb.CachingTimeSeries(new PersistentTimeSeries(user, server.id, seriesKey));
  };
};
