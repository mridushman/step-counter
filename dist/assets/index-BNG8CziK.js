import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setLogLevel, getFirestore, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
setLogLevel("debug");
const firebaseConfig = JSON.parse(typeof __firebase_config !== "undefined" ? __firebase_config : "{}");
const initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
let db;
let auth;
let userId = null;
const app = initializeApp(firebaseConfig);
db = getFirestore(app);
auth = getAuth(app);
async function signIn() {
  try {
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      await signInAnonymously(auth);
    }
  } catch (error) {
    console.error("Firebase Auth Error:", error);
    document.getElementById("status-message").textContent = "Error: Authentication failed. Please refresh.";
  }
}
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
    document.getElementById("user-id").textContent = userId;
    document.getElementById("status-message").textContent = "Ready to count steps!";
    setupStepCounter();
  } else {
    await signIn();
  }
});
let stepCount = 0;
let lastTimestamp = 0;
let lastY = 0;
let stepDetected = false;
let isCounting = false;
const getDocRef = (uid) => {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return doc(db, `artifacts/${appId}/users/${uid}/step_counter/${today}`);
};
const saveSteps = async (steps) => {
  if (!userId) {
    console.error("User ID is not available.");
    return;
  }
  const docRef = getDocRef(userId);
  try {
    await setDoc(docRef, { steps }, { merge: true });
  } catch (error) {
    console.error("Error writing document:", error);
    document.getElementById("status-message").textContent = "Error: Could not save steps.";
  }
};
const setupStepCounter = () => {
  const docRef = getDocRef(userId);
  onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      stepCount = docSnap.data().steps || 0;
      document.getElementById("step-count").textContent = stepCount;
    } else {
      stepCount = 0;
      document.getElementById("step-count").textContent = 0;
    }
  }, (error) => {
    console.error("Error listening for document changes:", error);
    document.getElementById("status-message").textContent = "Error: Failed to load steps.";
  });
  document.getElementById("start-button").addEventListener("click", startCounting);
  document.getElementById("stop-button").addEventListener("click", stopCounting);
};
const startCounting = async () => {
  if (isCounting) return;
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const permissionState = await DeviceMotionEvent.requestPermission();
      if (permissionState === "granted") {
        window.addEventListener("devicemotion", handleMotion);
        isCounting = true;
        document.getElementById("status-message").textContent = "Counting...";
        document.getElementById("start-button").disabled = true;
        document.getElementById("stop-button").disabled = false;
      } else {
        document.getElementById("status-message").textContent = "Permission denied. Please enable motion sensors.";
      }
    } catch (error) {
      console.error("Permission request error:", error);
      document.getElementById("status-message").textContent = "Error: Motion sensor access denied or not supported.";
    }
  } else {
    window.addEventListener("devicemotion", handleMotion);
    isCounting = true;
    document.getElementById("status-message").textContent = "Counting...";
    document.getElementById("start-button").disabled = true;
    document.getElementById("stop-button").disabled = false;
  }
};
const stopCounting = () => {
  if (!isCounting) return;
  window.removeEventListener("devicemotion", handleMotion);
  isCounting = false;
  document.getElementById("status-message").textContent = "Paused.";
  document.getElementById("start-button").disabled = false;
  document.getElementById("stop-button").disabled = true;
};
const handleMotion = (event) => {
  const acceleration = event.accelerationIncludingGravity;
  const y = acceleration.y;
  const threshold = 1.5;
  const minTimeBetweenSteps = 250;
  const now = Date.now();
  if (y > threshold && lastY < -threshold && now - lastTimestamp > minTimeBetweenSteps) {
    if (!stepDetected) {
      stepCount++;
      document.getElementById("step-count").textContent = stepCount;
      saveSteps(stepCount);
      lastTimestamp = now;
      stepDetected = true;
    }
  } else {
    stepDetected = false;
  }
  lastY = y;
};
window.startCounting = startCounting;
window.stopCounting = stopCounting;
window.saveSteps = saveSteps;
window.onSnapshot = onSnapshot;
