// Global to keep latest match info
let latestMatch = null;
let faceMatchInterval = null;

// Load face-api.js models
async function loadFaceApiModels() {
  console.log("⏳ Loading face-api.js models...");
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  console.log("✅ Face API models loaded.");
}

// Fetch all users
async function getUsers() {
  const res = await fetch('http://localhost:3000/load-users');
  if (!res.ok) throw new Error(`Failed to load users: ${res.statusText}`);
  return await res.json();
}

// Save all users
async function saveUsers(users) {
  const res = await fetch('http://localhost:3000/save-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(users),
  });
  if (!res.ok) throw new Error(`Failed to save users: ${res.statusText}`);
}

// Show a specific form and hide others
function showForm(formId) {
  const forms = ['loginForm', 'registerForm', 'faceLoginContainer'];
  forms.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(formId);
  if (target) target.style.display = 'block';
}

// Start face login
function startFaceLogin() {
  console.log("Start face login triggered");
  showForm('faceLoginContainer');
  loadFaceApiModels().then(() => {
    startVideo();
    setupButtons();
    faceMatchInterval = setInterval(detectAndMatchFaceLoop, 100);
  }).catch(err => {
    console.error("Error loading models for face login:", err);
  });

  const statusEl = document.getElementById('faceStatus');
  if (statusEl) {
    statusEl.textContent = "Please look at the camera...";
    statusEl.style.color = 'black';
  }
}

// Start webcam video
function startVideo() {
  const video = document.getElementById('faceVideo');
  const canvas = document.getElementById('faceCanvas');

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();

        // Match canvas to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.style.width = video.videoWidth + 'px';
        canvas.style.height = video.videoHeight + 'px';

        console.log("📷 Camera stream started and canvas synced");
      };
    })
    .catch(err => {
      console.error("Error accessing webcam:", err);
    });
}


//window.addEventListener('resize', () => {
 // const video = document.getElementById('faceVideo');
 // const canvas = document.getElementById('faceCanvas');
  //canvas.style.width = `${video.clientWidth}px`;
  //canvas.style.height = `${video.clientHeight}px`;
//});


// Setup login and retry buttons
function setupButtons() {
  const loginBtn = document.getElementById('faceLoginBtn') || createConfirmLoginButton();
  const retryBtn = document.getElementById('retryBtn') || createRetryButton();

  if (loginBtn) loginBtn.style.display = 'none';
  if (retryBtn) retryBtn.style.display = 'none';
}

// Create login button
function createConfirmLoginButton() {
  let existingBtn = document.getElementById('confirmLoginBtn');
  if (existingBtn) return existingBtn;

  const btn = document.createElement('button');
  btn.id = 'confirmLoginBtn';
  btn.textContent = '✅ Login';
  btn.style.marginTop = '10px';
  btn.style.display = 'none';  // start hidden
  btn.onclick = () => {
    const matchedUser = JSON.parse(localStorage.getItem('matchedUser'));
    if (!matchedUser) {
      alert("No matched user available to confirm.");
      return;
    }

    const confidence = parseFloat(localStorage.getItem('matchConfidence'));
    if (confidence < 60) {
      alert("Confidence too low. Cannot log in.");
      return;
    }

    localStorage.setItem('currentUser', JSON.stringify(matchedUser));
    window.location.href = 'dashboard.html';
  };

  document.getElementById('faceLoginContainer')?.appendChild(btn);
  return btn;
}



// Create retry button
function createRetryButton() {
  const btn = document.createElement('button');
  btn.id = 'retryBtn';
  btn.textContent = '🔁 Retry Face Login';
  btn.style.marginTop = '10px';
  btn.style.display = 'none';
  btn.onclick = () => {
    btn.style.display = 'none';
    latestMatch = null;
    const statusEl = document.getElementById('faceStatus');
    if (statusEl) {
      statusEl.textContent = "Please look at the camera...";
      statusEl.style.color = 'black';
    }
  };
  document.getElementById('faceLoginContainer').appendChild(btn);
  return btn;
}

// Draw face landmarks mesh on canvas
function drawFaceMesh(canvas, detections) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  faceapi.draw.drawFaceLandmarks(canvas, detections);
}

// Main face detect and match loop
function detectAndMatchFaceLoop() {
  const video = document.getElementById('faceVideo');
  const canvas = document.getElementById('faceCanvas');
  const statusEl = document.getElementById('faceStatus');
  const retryBtn = document.getElementById('retryBtn') || createRetryButton();

  const timeout = Date.now() + 5000;
  let interval;
  let matchFound = false;  // <-- track if match already found

  interval = setInterval(async () => {
    if (Date.now() > timeout) {
      if (!matchFound) {
        statusEl.textContent = "❌ No face match found. Try again.";
        statusEl.style.color = "red";
        retryBtn.style.display = "inline-block";
        clearInterval(interval);
        logMatchEvent(null, "fail", null);
      }
      return;
    }

    if (matchFound) return; // stop checking once matched

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length > 0) {
      drawFaceMesh(canvas, detections);

      const descriptor = detections[0].descriptor;
      const users = await getUsers();

      const validUsers = users.filter(u =>
        Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128
      );

      let bestMatch = null;
      let bestDistance = Infinity;

      for (const user of validUsers) {
        const dist = faceapi.euclideanDistance(descriptor, user.faceDescriptor);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestMatch = user;
        }
      }

      const confidence = ((1 - Math.min(bestDistance, 1)) * 100).toFixed(1);

      if (bestDistance < 0.6) {
        matchFound = true;           // mark match found
        clearInterval(interval);     // stop loop
        retryBtn.style.display = "none";
        statusEl.innerHTML = `✅ Match: ${bestMatch.username}<br>Confidence: ${confidence}%`;
        statusEl.style.color = "green";

        const loginBtn = document.getElementById('confirmLoginBtn') || createConfirmLoginButton();
        loginBtn.style.display = 'inline-block';

        localStorage.setItem('matchedUser', JSON.stringify(bestMatch));
        localStorage.setItem('matchConfidence', confidence);

        logMatchEvent(bestMatch.username, "match-ready", confidence);
      } else {
        statusEl.innerHTML = `❌ No strong match (Confidence: ${confidence}%)`;
        statusEl.style.color = "red";
        retryBtn.style.display = "inline-block";
        // Don't hide login button here to avoid flickering
      }
    }
  }, 100);
}




// Log match events locally (can later be sent to server)
function logMatchEvent(username, result, confidence) {
  const logs = JSON.parse(localStorage.getItem('faceLogs') || '[]');
  logs.push({
    username: username || "Unknown",
    result,
    confidence,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('faceLogs', JSON.stringify(logs));
}


async function registerUserFace() {
  const video = document.getElementById('faceVideo');
  if (!video || video.readyState < 2) {
    alert('Camera not ready yet. Please wait.');
    return;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      alert("No face detected. Try again.");
      return;
    }

    const confirm = window.confirm("Face detected. Do you want to register this face?");
    if (!confirm) return;

    const faceDescriptor = Array.from(detection.descriptor);
    const username = document.getElementById('faceUsername')?.value;
    if (!username) return alert('Please enter a username.');

    const users = await getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      alert("Username not found. Register first.");
      return;
    }

    user.faceDescriptor = faceDescriptor;
    await saveUsers(users);
    alert("Face registered successfully!");
    window.location.href = 'index.html';

  } catch (err) {
    console.error("Error during face registration:", err);
    alert("An error occurred. Check console.");
  }
}

async function registerUser() {
  const username = document.getElementById('registerUsername').value;
  const fullName = document.getElementById('registerFullName').value;
  const password = document.getElementById('registerPassword').value;

  if (!username || !fullName || !password) {
    alert("All fields are required!");
    return;
  }

  try {
    const users = await getUsers();
    if (users.find(user => user.username === username)) {
      alert("Username already exists.");
      return;
    }

    users.push({ username, fullName, password, faceDescriptor: null });
    await saveUsers(users);
    alert("User registered successfully!");
    window.location.href = 'index.html';

  } catch (err) {
    console.error("Error during user registration:", err);
    alert("An error occurred. Check console.");
  }
}

async function loginUser() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    alert("Both fields are required.");
    return;
  }

  try {
    const users = await getUsers();
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      window.location.href = 'dashboard.html';
    } else {
      alert("Invalid username or password.");
    }
  } catch (err) {
    console.error("Error during login:", err);
    alert("An error occurred. Check console.");
  }
}
