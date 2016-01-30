angular.module('starter.controllers', [])

.controller('AuthCtrl', function($scope, $stateParams, $state, User, Contacts, $cordovaToast, $ionicHistory, $ionicLoading) {
  $scope.login = false;
  $scope.$watch('login', function(){
    $scope.actionText = !$scope.login ? 'Get started' : 'Registering your device...';
  })
  var errHandler = function() {
    $scope.login = false;
    $cordovaToast.showLongBottom('Server error. Please try again.');
    throw new Error('Login failed');
  }
  $scope.Login = function() {
    $scope.login = true;
    User.getDeviceData().then(function(device_data) {
      return User.register(device_data);
    }).then(function(resp) {
    /*
      return User.registerPush(resp.sender_id);
    }, function(err) {
      errHandler();
    }).then(function() {
    */
      return Contacts.init();
    }, function(err) {
      errHandler();
    }).then(function() {
      $ionicLoading.show({template: 'Fetching contacts..'});
      return Contacts.fetch();
    }).then(function() {
      $ionicHistory.nextViewOptions({
        disableAnimate: true,
        disableBack: true
      });
      $state.go('tab.dash');
    }, function(err) {
      $cordovaToast.showLongBottom('You have to allow app to access contacts. Please click Re-fetch Contacts to rety.');
      $ionicHistory.nextViewOptions({
        disableAnimate: true,
        disableBack: true
      });
      $state.go('tab.dash');
    });
  }
})

.controller('AboutCtrl', function($scope, $stateParams, $cordovaAppVersion) {
  $scope.appVersion = '0.0.0';
  $scope.appName = 'Unknown';
  cordova.getAppVersion.getVersionNumber().then(function (appVersion) {
    $scope.appVersion = appVersion;
  });
  cordova.getAppVersion.getAppName().then(function (appName) {
    $scope.appName = appName;
  });
})

.controller('DashCtrl', function($scope, $http, $q, Contacts, Products, Credit, $cordovaToast, 
                                  $ionicLoading, $cordovaAppVersion, $cordovaNetwork, $rootScope,
                                  $cordovaDialogs) {
  $scope.total = 0; $scope.products = [];
  $scope.selectedProduct = Products.ids[0];
  $scope.credits = Credit.get();
  $scope.$on("$ionicView.enter", function() {
    Contacts.unchecked().then(function(contacts) {
      $ionicLoading.hide();
      $scope.total = contacts.length;
    });
  });
  $scope.stopScan = true;
  $scope.$watch('stopScan', function() {
    $scope.actionText = $scope.stopScan ? 'Start' : 'Stop';
  });
  $scope.$on(Credit.event, function() {
    $scope.credits = Credit.get();
  });
  $scope.appName = '';
  cordova.getAppVersion.getAppName().then(function (appName) {
    $scope.appName = '('+appName+')';
  });
  Products.init();
  $scope.$on(Products.event, function(e, lists) {
    $scope.products = lists;
  });
  $scope.ScanContacts = function() {
    $scope.stopScan = !$scope.stopScan;
    if(!$scope.stopScan) {
      return $cordovaDialogs.confirm('This will send your contacts number to our server for checking, and we would never store its history and result in the server. Click OK to continue.', 'Scan Contacts')
        .then(function(buttonIndex) {
        // no button = 0, 'OK' = 1, 'Cancel' = 2
        if(buttonIndex == 1) {

          var promise = Contacts.unchecked().then(function(contacts) {
            $scope.total = contacts.length;
            return contacts.reduce(function (p, contact) {
              return p.then(function() {
                return $http.post(apiEndpoint + '/check', { number: contact.number })
                  .then(function(res) {
                    if(typeof res.data.error == 'undefined' && res.data.error != 404) {
                      Contacts.update(contact.id, res.data).then(function() {
                        $scope.total--;
                      });
                    }
                    Credit.set(res.data.credits);
                    if($scope.stopScan || res.data.credits < 1) {
                      $scope.stopScan = true;
                      throw new Error('scan stopped');
                    }
                  }, function(err) {
                    $scope.stopScan = true;
                    $cordovaToast.showShortBottom('Server error. Please try again.');
                    throw new Error(err);
                  });
              });
            }, $q.when());
          });
          promise.then(function() {
            $scope.stopScan = true;
          });

        } else {
          $scope.stopScan = true;
        }
      });
    }
  };

  $scope.BuyCredit = function(productId) {
    store.order(productId);
  }

  $rootScope.$on('$cordovaNetwork:online', function(event, networkState){
    if($scope.products.length == 0)
      store.trigger('refreshed');
  });

})

.controller('ContactDetailCtrl', function($scope, $stateParams, Contacts, $state, $cordovaToast, $ionicLoading) {
  $scope.contact = {}; $scope.scanned = {checked: false};
  Contacts.get($stateParams.contactId).then(function(contact) {
    $scope.contact = contact;
    $scope.scanned.checked = contact.checked == 1;
  });
  $scope.$watch('scanned.checked', function(newValue, oldValue) {
    Contacts.mark($stateParams.contactId, newValue);
  });
  $scope.delete = function(contactId) {
    $ionicLoading.show({template: 'Deleting..'});
    Contacts.delete(contactId).then(function() {
      $ionicLoading.hide();
      $scope.$emit('Contacts:updated');
      $state.go('tab.contacts');
    });
  }
})

.controller('ContactsCtrl', function($scope, Contacts, $state, $cordovaToast, $ionicLoading, $cordovaDialogs, $rootScope) {
  $scope.viewDetail = function(contactId) {
    $state.go('tab.contact-detail', {contactId: contactId});
  };
  //$scope.$on('$ionicView.beforeEnter', function() {});
  $rootScope.$on('Contacts:updated', function() {
    $cordovaToast.showShortBottom('Contact deleted');
    Contacts.all().then(function(contacts) {
      $scope.query.searchStr = '';
      $scope.contacts = contacts;
    });
  });
  $scope.contacts = [];
  Contacts.all().then(function(contacts) {
    $scope.contacts = contacts;
  });
  var page = 0; $scope.noMoreItemsAvailable = false;
  $scope.loadMore = function() {
    if(!$scope.noMoreItemsAvailable)
      page++;
    Contacts.all({page: page, search: $scope.query.searchStr}).then(function(contacts) {
      if(contacts.length > 0)
        $scope.contacts = $scope.contacts.concat(contacts);
      else
        $scope.noMoreItemsAvailable = true;
      $scope.$broadcast('scroll.infiniteScrollComplete');
    });
  }

  $scope.query = {};
  $scope.Search = function() {
    Contacts.all({search: $scope.query.searchStr}).then(function(contacts) {
      page = 0; $scope.noMoreItemsAvailable = false;
      $scope.contacts = contacts;
    });
  }
  $scope.RefreshContacts = function() {
    Contacts.all().then(function(contacts) {
      page = 0; $scope.noMoreItemsAvailable = false;
      $scope.query.searchStr = '';
      $scope.contacts = contacts;
      $scope.$broadcast('scroll.refreshComplete');
    });
  }
  $scope.ResyncContacts = function() {
    $cordovaDialogs.confirm('This will fetch your contacts data to app, and will take some time. Click OK to continue.', 'Re-fetch contacts')
      .then(function(buttonIndex) {
      // no button = 0, 'OK' = 1, 'Cancel' = 2
      if(buttonIndex == 1) {
        $ionicLoading.show({template: 'Fetching..'});
        Contacts.fetch().then(function() {
          return Contacts.all();
        }, function(err) {
          $ionicLoading.hide();
        }).then(function(contacts) {
          page = 0; $scope.noMoreItemsAvailable = false;
          $scope.query.searchStr = '';
          $scope.contacts = contacts;
          $ionicLoading.hide();
        });
      }
    });
  };
});
