angular.module('starter.services', [])

.factory('User', function($q, $cordovaDevice, $http, $cordovaPush, $cordovaToast, $rootScope, Credit) {
  var self = this;

  self.isAndroid = function() {
    return $cordovaDevice.getPlatform().toLowerCase() == 'android';
  } 

  self.isIos = function() {
    return $cordovaDevice.getPlatform().toLowerCase() == 'ios';
  }

  self.getSimData = function() {
    var q = $q.defer();
    window.plugins.sim.getSimInfo(function(sim_data) {
      q.resolve(sim_data);
    });
    return q.promise;
  }
  self.getUniqueDeviceID = function() {
    var q = $q.defer();
    window.plugins.uniqueDeviceID.get(function(udid) {
      q.resolve(udid);
    });
    return q.promise;
  }
  self.getDeviceData = function() { 
    var device_data = $cordovaDevice.getDevice();
    return self.getSimData().then(function(sim_data) {
      angular.extend(device_data, sim_data);
      return self.getUniqueDeviceID();
    }).then(function(udid) {
      angular.extend(device_data, {udid: udid});
      return device_data;
    });
  }
  self.register = function(device_data) {
    var q = $q.defer();
    $http.post(apiEndpoint+'/auth', device_data).success(function(resp) {
      if(typeof resp.auth_token == 'undefined' || typeof resp.credits == 'undefined')
        return q.reject('whoops');
      window.localStorage.setItem('auth_token', resp.auth_token);
      Credit.set(resp.credits);
      $http.defaults.headers.common.Authorization = 'Bearer '+resp.auth_token;
      q.resolve(resp);
    }).error(function(err) {
      q.reject(err);
    });
    return q.promise;
  };
  self.registerPush = function(sender_id) {
    return $cordovaPush.register({senderID: sender_id, badge: true, sound: true, alert: true})
      .then(function(deviceToken) {
        if(self.isIos())
          return $http.post(apiEndpoint+'/register-push', {push_token: deviceToken});
    });
  }
  self.listenPush = function() {
    $rootScope.$on('$cordovaPush:notificationReceived', function(event, notification) {
      if(self.isIos()) {

        if (notification.alert) {
          navigator.notification.alert(notification.alert);
        }

        if (notification.sound && window.Media) {
          var snd = new Media(event.sound);
          snd.play();
        }

        if (notification.badge) {
          $cordovaPush.setBadgeNumber(notification.badge);
        }
      } else if(self.isAndroid()) {

        switch(notification.event) {
          case 'registered':
            if (notification.regid.length > 0 ) {
              $http.post(apiEndpoint+'/register-push', {push_token: notification.regid});
            }
            break;

          case 'message':
            $cordovaToast.showLongBottom(notification.message);
            break;

          case 'error':
            $cordovaToast.showShortBottom('GCM error: ' + notification.msg);
            break;

          default:
            $cordovaToast.showShortBottom('An unknown GCM event has occurred');
            break;
        }
      }
    });
  }

  return self;
})

.factory('DBA', function($cordovaSQLite, $q) {
  var self = this, db = null;
 
  if(window.cordova) {
    // App syntax
    db = $cordovaSQLite.openDB("myapp.db");
  } else {
    // Ionic serve syntax
    db = window.openDatabase("myapp.db", "1.0", "My app", -1);
  }
  // Handle query's and potential errors
  self.query = function (query, parameters) {
    parameters = parameters || [];
    var q = $q.defer();
 
    $cordovaSQLite.execute(db, query, parameters)
      .then(function (result) {
        q.resolve(result);
      }, function (error) {
        console.warn('I found an error');
        console.warn(error);
        q.reject(error);
      });
    return q.promise;
  }
 
  // Proces a result set
  self.getAll = function(result) {
    var output = [];
 
    for (var i = 0; i < result.rows.length; i++) {
      output.push(result.rows.item(i));
    }
    return output;
  }
 
  // Proces a single result
  self.getById = function(result) {
    var output = null;
    output = angular.copy(result.rows.item(0));
    return output;
  }
 
  return self;
})

.factory('Credit', function($rootScope) {
  var storageKey = 'credits', storageEvent = 'Credit.updated';
  return {
    event: storageEvent,
    set: function(val) {
      window.localStorage && window.localStorage.setItem(storageKey, val);
      $rootScope.$broadcast(storageEvent); 
      return this;
    },
    get: function() {
      return window.localStorage.getItem(storageKey);
    }
  };
})

.factory('Products', function( $q, $http, $cordovaToast, $rootScope, Credit, $cordovaToast, $cordovaNetwork) {
  var self = this,
      ids = ['1credits', '2credits', '5credits', '10credits', 
            '20credits', '50credits', '100credits'];

  self.ids = ids;

  // todo // return empty if one of products has canPurchase:false
  self.list = function() {
    var q = $q.defer();
    q.resolve(store.products);
    return q.promise;
  };

  self.init = function() {
    store.verbosity = store.DEBUG;
    store.error(function(e) {
      console.log("ERROR " + e.code + ": " + e.message);
    });
    store.error(store.ERR_SETUP, function() {
      if($cordovaNetwork.isOnline())
        store.trigger('refreshed');
    });
    // validate purchase
    store.validator = function(product, callback) {
      $http.post(apiEndpoint+'/check-purchase', product).success(function(resp) {
        Credit.set(resp.credits);
        callback(true, resp); // success!
        $cordovaToast.showShortBottom('Purchase is verified.');
      }).error(function(err) {
        callback(false, {
          error: {
            code: store.PURCHASE_EXPIRED,
            message: "foo"
          }
        });
        $cordovaToast.showShortBottom('Purchase is failed to verify.');
      });
    };

    self.event = 'Products.updated';
    store.when('product').loaded(function(product) {
      self.list().then(function(lists) {
        $rootScope.$broadcast(self.event, lists); 
      });
    });
      
    store.when('order').approved(function(product) {
      product.verify();
    });

    store.when('order').verified(function(product) {
      product.finish();
    });
    // register product
    return self.register().then(function() {
      return store.refresh();
    });
  };
  self.register = function() {
    var q = $q.defer();
    angular.forEach(ids, function(productId) {
      q.resolve(store.register({
        id: productId,
        type: store.CONSUMABLE
      }));
    });
    return q.promise;
  }

  return self;
})

.factory('Contacts', function($q, DBA) {
  var self = this;

  String.prototype.hashCode = function() {
    var hash = 0, i, chr, len;
    if (this.length == 0) return hash;
    for (i = 0, len = this.length; i < len; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  };

  self.init = function() {
    return DBA.query('DROP TABLE IF EXISTS Contacts').then(function() {
      return DBA.query("CREATE TABLE IF NOT EXISTS Contacts (id integer primary key, "+
        "name text, number text, cid integer, uid text, "+
        "checked int default 0, country_code text, carrier_name text, number_type text)");
    });
  }

  self.fetch = function() {
    var contacts_data = [], 
        q = $q.defer();

    navigator.contactsPhoneNumbers.list(function(contacts) {
      for (var i = 0; i < contacts.length; i++) {
        var contact_data = null;
        if(contacts[i].phoneNumbers.length > 0) {
          for(var j = 0; j < contacts[i].phoneNumbers.length; j++) {
          //var j = contacts[i].phoneNumbers.length - 1;
          //if(contacts[i].phoneNumbers[j].type.toLowerCase() == 'mobile') {
            contact_data = {
              cid: contacts[i].id,
              uid: contacts[i].phoneNumbers[j].number.toString().hashCode(),
              name: contacts[i].displayName, 
              number: contacts[i].phoneNumbers[j].number
            };
            contacts_data.push(contact_data);
            DBA.query('INSERT INTO Contacts (name, number, cid, uid, checked) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM Contacts WHERE uid = ?)', 
              [contact_data.name, contact_data.number, contact_data.cid, contact_data.uid, 0, contact_data.uid]);
          }
        }
      }
      q.resolve(contacts_data);
    }, function(error) {
      q.reject(error);
    });
    return q.promise;
  }

  self.all = function(param) {
    if(typeof param == 'undefined')
      var param = {};
    if(typeof param.search == 'undefined')
      param.search = '';
    if(typeof param.limit == 'undefined')
      param.limit = 10;
    if(typeof param.page == 'undefined')
      param.page = 0;
    param.page = param.page * param.limit;
    var searchQry = '';
    if(param.search !== '')
      searchQry = "WHERE name like '%"+param.search+"%' "+
        "OR number like '%"+param.search+"%' "+
        "OR REPLACE(REPLACE(REPLACE(number, '+', ''), '-', ''), ' ', '') like '%"+param.search+"%' ";
    return DBA.query("SELECT * FROM Contacts "+searchQry+
      "ORDER BY LOWER(name) limit "+param.page+", "+param.limit)
      .then(function(result) {
        return DBA.getAll(result);
      });
  }

  self.get = function(contactId) {
    return DBA.query("SELECT * FROM Contacts WHERE id = "+contactId)
      .then(function(result) {
        return DBA.getById(result);
      });
  };

  self.mark = function(contactId, scanned) {
    var checked = 0;
    if(scanned === true)
      checked = 1;
    return DBA.query("UPDATE Contacts SET checked="+checked+" WHERE id="+contactId+" AND checked!="+checked);
  }

  self.delete = function(contactId) {
    return DBA.query("DELETE FROM Contacts WHERE id="+contactId);
  }

  self.unchecked = function() {
    return DBA.query("SELECT * FROM Contacts WHERE checked=0 ORDER BY LOWER(name)")
      .then(function(result) {
        return DBA.getAll(result);
      });
  };

  self.update = function(contactId, data) {
    return DBA.query("UPDATE Contacts SET checked=1, country_code='"+data.country_code+"', carrier_name='"+data.carrier_name+"', number_type='"+data.number_type+"' WHERE id="+contactId);
  };

  return self;
});
