// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
var debug = true, 
    apiEndpoint = 'http://whatscarrier.com/api/v1';

angular.module('starter', ['ionic', 'starter.controllers', 'starter.services', 'ngCordova', 'ngIOS9UIWebViewPatch'])

.run(function($http, User, $location, $cordovaAppVersion) {

  // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
  // for form inputs)
  if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
    cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
  }
  if (window.StatusBar) {
    // org.apache.cordova.statusbar required
    StatusBar.styleLightContent();
  }

  User.listenPush();
  if(window.cordova)
    cordova.getAppVersion.getVersionNumber().then(function (appVersion) {
      $http.defaults.headers.common['App-Version'] = appVersion;
    });
  var auth_token = window.localStorage.getItem('auth_token');

  if(auth_token) {
    $http.defaults.headers.common.Authorization = 'Bearer '+auth_token;
    $location.path('/tab/dash');
  }
})

.config(function($stateProvider, $urlRouterProvider, $compileProvider) {

  $compileProvider.aHrefSanitizationWhitelist(/^\s*(sms|tel|mailto):/);

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider

  .state('auth', {
    url: '/auth',
    templateUrl: 'templates/auth.html',
    controller: 'AuthCtrl'
  })
  // setup an abstract state for the tabs directive
  .state('tab', {
    url: "/tab",
    abstract: true,
    templateUrl: "templates/tabs.html"
  })

  // Each tab has its own nav history stack:

  .state('tab.dash', {
    url: '/dash',
    views: {
      'tab-dash': {
        templateUrl: 'templates/tab-dash.html',
        controller: 'DashCtrl'
      }
    }
  })

    .state('tab.contact-detail', {
      url: '/contacts/:contactId',
      views: {
        'tab-contacts': {
          templateUrl: 'templates/contact-detail.html',
          controller: 'ContactDetailCtrl'
        }
      }
    })

  .state('tab.about', {
    url: '/about',
    views: {
      'tab-about': {
        templateUrl: 'templates/tab-about.html',
        controller: 'AboutCtrl'
      }
    }
  })
    .state('tab.contacts', {
      url: '/contacts',
      views: {
        'tab-contacts': {
          templateUrl: 'templates/tab-contacts.html',
          controller: 'ContactsCtrl'
        }
      }
    });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/auth');

});
