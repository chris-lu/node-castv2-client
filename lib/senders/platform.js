var util                  = require('util');
var Client                = require('castv2').Client;
var debug                 = require('debug')('castv2-client');
var Sender                = require('./sender');
var ConnectionController  = require('../controllers/connection');
var HeartbeatController   = require('../controllers/heartbeat');
var ReceiverController    = require('../controllers/receiver');

function PlatformSender() {
  Sender.call(this, new Client(), 'sender-0', 'receiver-0');

  this.connection = null;
  this.heartbeat = null;
  this.receiver = null;
}

util.inherits(PlatformSender, Sender);

PlatformSender.prototype.connect = function (options, callback) {
  var self = this;

  self.client.on('error', onerror);
  function onerror(err) {
    self.emit('error', err);
  }

  this.client.connect(options, function () {
    self.connection = self.createController(ConnectionController);
    self.heartbeat  = self.createController(HeartbeatController);
    self.receiver   = self.createController(ReceiverController);

    self.receiver.on('status', onstatus);

    self.client.once('close', onclose);

    function onstatus(status) {
      self.emit('status', status);
    }

    function onclose() {
      self.heartbeat.stop();
      self.receiver.removeListener('status', onstatus);
      self.receiver.close();
      self.heartbeat.close();
      self.connection.close();
      self.receiver = null;
      self.heartbeat = null;
      self.connection = null;
      self.emit('close');
      Sender.prototype.close.call(self);
    }

    self.heartbeat.once('timeout', ontimeout);

    function ontimeout() {
      self.emit('timeout', new Error('Device ' + self.id + ' timeout'));
      self.emit('close', new Error('Device ' + self.id + ' timeout'));
    }

    self.connection.connect();
    self.heartbeat.start();
    callback();
  });
};

PlatformSender.prototype.close = function () {
  this.client.close();
};

PlatformSender.prototype.getStatus = function (callback) {
  if(this.receiver) {
    this.receiver.getStatus(callback);
  }
};

PlatformSender.prototype.getSessions = function (callback) {
  if(this.receiver) {
    this.receiver.getSessions(callback);
  }
};

PlatformSender.prototype.getAppAvailability = function (appId, callback) {
  this.receiver.getAppAvailability(appId, function (err, availability) {
    if (err) return callback(err);
    for (key in availability) {
      availability[key] = (availability[key] === 'APP_AVAILABLE');
    }
    callback(err, availability);
  });
};

PlatformSender.prototype.join = function (session, Application, callback) {
  callback(null, new Application(this.client, session));
};

PlatformSender.prototype.launch = function (Application, callback) {
  var self = this;

  this.receiver.launch(Application.APP_ID, function (err, sessions) {
    if (err) return callback(err);

    var filtered = sessions.filter(function (session) {
      return session.appId === Application.APP_ID;
    });
    var session = filtered.shift();

    self.join(session, Application, callback);
  });
};

PlatformSender.prototype.stop = function (application, callback) {
  var session = application.session;
  application.close();
  if (this.receiver && session) {
    this.receiver.stop(session.sessionId, callback);
  }
};

PlatformSender.prototype.setVolume = function (volume, callback) {
  if(this.receiver) {
    this.receiver.setVolume(volume, callback);
  }
};

PlatformSender.prototype.getVolume = function (callback) {
  if(this.receiver) {
    this.receiver.getVolume(callback);
  }
};

module.exports = PlatformSender;