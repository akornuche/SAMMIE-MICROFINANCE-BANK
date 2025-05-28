// script.js - MediaPipe FaceMesh version

let matchedUser = null;

// Fetch all users from backend
async function getUsers() {
  const response = await fetch('http://localhost:3000/load-users');
  return await response.json();
}

// Save users to backend
async function saveUsers(users) {
  await fetch('http://localhost:3000/save-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(users),
  });
}

// Show a form (login, register, faceLoginContainer)
function showForm(formId) {
  const forms = ['loginForm', 'registerForm', 'faceLoginContainer'];
  forms.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(formId);
  if (target) target.style.display = 'block';
}

// Load MediaPipe FaceMesh
let faceMesh, videoElement;

async function initFaceMesh() {
  videoElement = document.getElementById('faceVideo');
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  await videoElement.play();

  if (!faceMesh) {
    faceMesh = new FaceMesh({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceResults);
  }

  // Trigger detection loop
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  camera.start();
}

// Capture face during registration
async function registerUserFace() {
  const username = document.getElementById('faceUsername')?.value;
  if (!username) return alert('Please enter a username');

  await initFaceMesh();
  detecting = 'register';
}

document.getElementById('faceLoginBtn').addEventListener('click', startFaceLogin);

// Start face login
async function startFaceLogin() {
  document.getElementById('faceLoginBtn').style.display = 'none';
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('faceLoginContainer').style.display = 'block';
  document.getElementById('faceStatus').textContent = "Please look at the camera...";

  await initFaceMesh();
  detecting = 'login';
}

let detecting = null;

// Handle face detection results
async function onFaceResults(results) {
  const canvas = document.getElementById('faceCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 320;
  canvas.height = 240;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    console.log("No face detected");
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  const flatLandmarks = landmarks.flatMap(pt => [pt.x, pt.y, pt.z]);
  console.log("Detected Face Descriptor:", flatLandmarks);

  // Draw bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  landmarks.forEach(pt => {
    const x = pt.x * canvas.width;
    const y = pt.y * canvas.height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

  if (detecting === 'register') {
    const users = await getUsers();
    const currentUser = users.find(user => user.username === document.getElementById('faceUsername').value);
    if (!currentUser) return alert('Username not found');

    currentUser.faceDescriptor = flatLandmarks;
    await saveUsers(users);
    alert('Face registered successfully!');
    detecting = null;
    stopVideo();
    window.location.href = 'index.html';

  } else if (detecting === 'login') {
    const users = await getUsers();
    let found = false;

    for (const user of users) {
      if (user.faceDescriptor) {
        const dist = compareLandmarks(user.faceDescriptor, flatLandmarks);
        console.log(`Comparing with ${user.username}, distance:`, dist);

        if (dist < 0.07) {
          document.getElementById('faceStatus').textContent = `Face matched: ${user.fullName}`;
          document.getElementById('faceStatus').style.color = "green";
          matchedUser = user; // Save user for manual login
          detecting = null;
          
          document.getElementById('confirmLoginBtn').style.display = 'inline-block';
          found = true;
          break;
        }        
      }
    }

    if (!found) {
      document.getElementById('faceStatus').textContent = "Face not recognized.";
      document.getElementById('faceStatus').style.color = "red";
    }
  }
}


// Stop video stream
function stopVideo() {
  const stream = videoElement?.srcObject;
  if (stream) stream.getTracks().forEach(track => track.stop());
}

// Compare two sets of landmarks and return distance
function compareLandmarks(a, b) {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.pow(a[i] - b[i], 2);
  return Math.sqrt(sum / a.length); // Normalized distance
}

// Register user
async function registerUser() {
  const username = document.getElementById('registerUsername').value;
  const fullName = document.getElementById('registerFullName').value;
  const password = document.getElementById('registerPassword').value;

  if (!username || !fullName || !password) return alert('All fields are required!');

  const users = await getUsers();
  if (users.find(user => user.username === username)) return alert('Username already exists');

  users.push({ username, fullName, password, faceDescriptor: null });
  await saveUsers(users);
  alert('User registered successfully!');
  window.location.href = 'index.html';
}

// Login user with credentials
async function loginUser() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) return alert('Both fields are required!');

  const users = await getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    window.location.href = 'dashboard.html';
  } else {
    alert('Invalid username or password');
  }
}

function confirmFaceLogin() {
  if (!matchedUser) {
    alert("No matched user. Please detect your face again.");
    return;
  }
  stopVideo();
  localStorage.setItem('currentUser', JSON.stringify(matchedUser));
  window.location.href = 'dashboard.html';
}

