let capturedFaceDescriptor = null;

// Check if a user is logged in
const user = JSON.parse(localStorage.getItem('currentUser'));
if (!user) {
  window.location.href = 'index.html';
} else {
  document.getElementById('welcomeName').textContent = `Welcome, ${user.fullName}`;
  document.getElementById('faceUsername').value = user.username;
}

window.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('faceFormBtn').style.display = 'inline-block';
});

function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

function showForm(id) {
  const formIds = ['faceForm'];
  
  formIds.forEach(formId => {
    const el = document.getElementById(formId);
    if (el) {
      el.style.display = 'none';
      if (formId === 'faceForm') stopVideo();
    }
  });

  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'block';
    if (id === 'faceForm') {
      startVideo();
      initFaceMesh();
    }
  }
}

function onFaceResults(results) {
  const canvas = document.getElementById('faceCanvas');
  const video = document.getElementById('faceVideo');

  if (!canvas || !video) return;

  const ctx = canvas.getContext('2d');
  canvas.width = 320;
  canvas.height = 240;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const face = results.multiFaceLandmarks[0];

    // Draw bounding box
    const xs = face.map(pt => pt.x * canvas.width);
    const ys = face.map(pt => pt.y * canvas.height);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Capture descriptor
    capturedFaceDescriptor = face.map(pt => [pt.x, pt.y, pt.z]);
  } else {
    capturedFaceDescriptor = null;
  }
}



function registerUserFace() {
  const username = document.getElementById('faceUsername').value;

  if (!capturedFaceDescriptor) {
    alert("No face detected. Please make sure your face is visible to the camera.");
    return;
  }

  fetch('http://localhost:3000/save-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username,
      faceDescriptor: capturedFaceDescriptor
    })
  })
  .then(res => res.json())
  .then(data => {
    alert('Face registered successfully!');
    console.log(data);
  })
  .catch(err => {
    console.error('Face save failed:', err);
    alert('Error saving face data.');
  });
}

let isCameraStarted = false;

function startVideo() {
  const video = document.getElementById('faceVideo');
  if (!video) return console.error("Video element not found.");
  if (isCameraStarted) return console.log("Camera already started.");

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().then(() => {
          isCameraStarted = true;
          console.log("Video started.");
        }).catch(err => console.error("Error playing video:", err));
      };
    })
    .catch(err => console.error("Error accessing camera:", err));
}

function stopVideo() {
  const video = document.getElementById('faceVideo');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    isCameraStarted = false;
    console.log("Camera stopped.");
  }
}

function initFaceMesh() {
  const videoElement = document.getElementById('faceVideo');

  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onFaceResults);

  const camera = new Camera(videoElement, {
    onFrame: async () => await faceMesh.send({ image: videoElement }),
    width: 640,
    height: 480
  });

  camera.start();
}
