// dashboard.js

console.log('✅ dashboard.js is running'); // Confirm script is loaded

// Check if a user is logged in
const user = JSON.parse(localStorage.getItem('currentUser'));
if (!user) {
  console.warn('⚠️ No user found in localStorage. Redirecting to login...');
  window.location.href = 'index.html';
} else {
  console.log(`👤 Logged in as: ${user.username}`);
  document.getElementById('welcomeName').textContent = `Welcome, ${user.fullName}`;

  const faceUsernameInput = document.getElementById('faceUsername');
  if (faceUsernameInput) {
    faceUsernameInput.value = user.username;
  }
}

let modelsLoaded = false;

window.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM content fully loaded');

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    console.warn('⚠️ User session expired. Redirecting...');
    window.location.href = 'index.html';
    return;
  }

  const faceFormBtn = document.getElementById('faceFormBtn');
  if (faceFormBtn) {
    faceFormBtn.style.display = 'inline-block';
    console.log('📸 "Register Face" button displayed');
  }
});

// Logout function
function logout() {
  console.log('🚪 Logging out...');
  stopVideo();
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

// Show a specific form
function showForm(id) {
  console.log(`🔄 Switching to form: ${id}`);

  ['faceForm'].forEach(formId => {
    const el = document.getElementById(formId);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'block';

    if (id === 'faceForm') {
      startVideo();
      loadFaceApiModels();
    }
  }
}

// Start webcam
function startVideo() {
  const video = document.getElementById('faceVideo');
  if (!video) {
    console.error("❌ Video element not found.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      console.log('📷 Camera stream started');
    })
    .catch(err => {
      console.error("❌ Camera access error:", err);
    });
}

// Stop webcam
function stopVideo() {
  const video = document.getElementById('faceVideo');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    console.log('📴 Camera stopped');
  }
}

// Load face-api.js models (only once)
function loadFaceApiModels() {
  if (modelsLoaded) {
    console.log('✅ Models already loaded, skipping...');
    return;
  }

  if (typeof faceapi === 'undefined') {
    console.error("❌ face-api.js is not loaded.");
    return;
  }

  console.log('⏳ Loading face-api.js models...');

  Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models/ssd_Mobilenetv1'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68')
  ])
    .then(() => {
      console.log('✅ Face API models loaded successfully.');
      modelsLoaded = true;
    })
    .catch(err => {
      console.error('❌ Error loading models:', err);
    });
}

// Register user's face
async function registerUserFace() {
  console.log('📸 Starting face registration...');

  const video = document.getElementById('faceVideo');
  const statusEl = document.getElementById('faceStatusForm');
  const captureBtn = event?.target;

  if (!video || video.readyState < 2) {
    console.warn('⚠️ Camera not ready.');
    alert('Camera not ready yet. Please wait.');
    return;
  }

  if (statusEl) {
    statusEl.style.color = 'black';
    statusEl.textContent = 'Detecting face...';
  }

  if (captureBtn) {
    captureBtn.disabled = true;
    captureBtn.textContent = 'Saving...';
  }

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.warn('❌ No face detected.');
      if (statusEl) {
        statusEl.textContent = 'No face detected. Try again.';
        statusEl.style.color = 'red';
      }
      faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector');

      return;
    }

    const faceDescriptor = Array.from(detection.descriptor);
    console.log('✅ Face detected:', faceDescriptor);

    const username = document.getElementById('faceUsername')?.value;
    if (!username) {
      alert('Please enter a username.');
      return;
    }

    console.log('📡 Fetching users from backend...');
    const res = await fetch('http://localhost:3000/load-users');
    if (!res.ok) throw new Error("Failed to load users from backend");

    const users = await res.json();
    const matchedUser = users.find(u => u.username === username);

    if (!matchedUser) {
      alert("Username not found. Register first.");
      return;
    }

    matchedUser.faceDescriptor = faceDescriptor;

    console.log('💾 Saving updated user...');
    const saveRes = await fetch('http://localhost:3000/save-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users)
    });
    if (!saveRes.ok) throw new Error("Failed to save users to backend");

    if (statusEl) {
      statusEl.textContent = 'Face registered and saved successfully!';
      statusEl.style.color = 'green';
    }

    // Update localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (matchedUser.username === currentUser.username) {
      currentUser.faceDescriptor = faceDescriptor;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      console.log('🧠 Local user updated in localStorage');
    }

    console.log('✅ Face registration complete. Redirecting...');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);

  } catch (err) {
    console.error("❌ Error during face registration:", err);
    if (statusEl) {
      statusEl.textContent = 'Error saving face. Check console.';
      statusEl.style.color = 'red';
    }
  } finally {
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.textContent = 'Capture & Save Face';
    }
  }
}
