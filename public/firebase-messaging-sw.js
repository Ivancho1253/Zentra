importScripts("https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAFFzc_sLdlI3ODNdbeZcdeOfCN5QYFz1Q",
  authDomain: "gen-lang-client-0508893636.firebaseapp.com",
  projectId: "gen-lang-client-0508893636",
  storageBucket: "gen-lang-client-0508893636.firebasestorage.app",
  messagingSenderId: "43234516831",
  appId: "1:43234516831:web:793d28847549bf82e660ea",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "ZENTRA alert";
  const options = {
    body: payload.notification?.body || "A portfolio alert was triggered.",
    icon: "/logo.png",
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});
