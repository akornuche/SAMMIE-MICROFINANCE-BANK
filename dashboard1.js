// dashboard.js

// Check if a user is logged in
const user = JSON.parse(localStorage.getItem('currentUser'));
if (!user) {
  window.location.href = 'index.html';
} else {
  document.getElementById('welcomeName').textContent = `Welcome, ${user.fullName}`;

  // Populate the registered username field with the active user's username
  document.getElementById('faceUsername').value = user.username;
}

// Wait for DOM content to load
window.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'index.html'; // Redirect to login if user is not logged in
    return;
  }

  // Show the "Register Face" button only if logged in
  document.getElementById('faceFormBtn').style.display = 'inline-block';
});

// Function to logout
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

// Show the selected form (either login, register, or faceForm)
function showForm(id) {
  // Hide all forms first
  ['faceForm'].forEach(formId => {
    const el = document.getElementById(formId);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'block';

    if (id === 'faceForm') {
      startVideo(); // Only start video when the form is visible
      loadFaceApiModels(); // Load models for face recognition when needed
    }
  }
}

// Function to start video capture from webcam
function startVideo() {
  const video = document.getElementById('faceVideo');
  if (!video) {
    console.error("Video element not found. Cannot start video.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
    })
    .catch(err => {
      console.error("Error accessing camera:", err);
    });
}

// Load face-api.js models
function loadFaceApiModels() {
  Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models/ssd_Mobilenetv1'),
    faceapi.nets.tinyFaceDetector.loadFromUri('./models/tiny_face_detector'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models/face_recognition'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models/face_landmark_68')
  ])
  .then(() => console.log('Face API models loaded successfully.'))
  .catch(err => console.error('Error loading models:', err));
}
