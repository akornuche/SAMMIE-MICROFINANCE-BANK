
// Fetch all users from backend
async function getUsers() {
  const response = await fetch('http://localhost:3000/load-users');
  return await res.json();
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
  const forms = ['loginForm', 'registerForm', 'faceLoginContainer']; // Add all form IDs here
  forms.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(formId);
  if (target) target.style.display = 'block';
}

// Helper functions to communicate with backend
async function getUsers() {
  const res = await fetch('http://localhost:3000/load-users');
  return await res.json();
}

async function saveUser(user) {
  await fetch('http://localhost:3000/load-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
}

// Load face-api.js models
async function loadFaceApiModels() {
  //await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
}

// Start face login process
function startFaceLogin() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('faceLoginContainer').style.display = 'block';

  loadFaceApiModels().then(() => {
    startVideo();
  });

  document.getElementById('faceStatus').textContent = "Please look at the camera...";
  detectAndMatchFaceLoop();
}

// Start the video stream for face login
function startVideo() {
  const video = document.getElementById('faceVideo');
  if (!video) {
    console.error('Video element not found. Cannot start video.');
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream;
      video.play();
    })
    .catch(err => {
      console.error('Error accessing webcam: ', err);
    });
}

// Continuously detect face and match
function detectAndMatchFaceLoop() {
  const video = document.getElementById('faceVideo');
  const timeout = Date.now() + 5000; // 5 seconds

  const interval = setInterval(async () => {
    if (Date.now() > timeout) {
      document.getElementById('faceStatus').textContent = "No face match found. Try again.";
      document.getElementById('faceStatus').style.color = "red";
      clearInterval(interval);
      return;
    }

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length > 0) {
      const faceDescriptor = detections[0].descriptor;
      const users = await getUsers();  // Assuming you fetch from backend now

      const matchedUser = users.find(user => {
        if (!user.faceDescriptor) return false;
        return compareDescriptors(user.faceDescriptor, faceDescriptor);
      });

      if (matchedUser) {
        clearInterval(interval);
        document.getElementById('faceStatus').textContent = "Login successful!";
        document.getElementById('faceStatus').style.color = "green";
        localStorage.setItem('currentUser', JSON.stringify(matchedUser));
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 2000);
      }
    }
  }, 100);
}



// Compare two face descriptors using Euclidean distance
function compareDescriptors(descriptor1, descriptor2) {
  return faceapi.euclideanDistance(descriptor1, descriptor2) < 0.6;
}

// Register face for the user during registration process
async function registerUserFace() {
  const video = document.getElementById('faceVideo');
  if (!video || video.readyState < 2) {
    alert('Camera not ready yet. Please wait a moment.');
    return;
  }

  try {
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ inputSize: 160 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    console.log("Face detection result:", detections);

    if (!detections) {
      alert('No face detected. Please try again.');
      return;
    }

    const faceDescriptor = Array.from(detections.descriptor);
    const username = document.getElementById('faceUsername')?.value;
    if (!username) {
      alert('Please enter a username');
      return;
    }

    const users = await getUsers();
    const currentUser = users.find(user => user.username === username);

    if (currentUser) {
      currentUser.faceDescriptor = faceDescriptor;
      await saveUsers(users); // Save to backend
      alert('Face registered successfully!');
      window.location.href = 'index.html';
    } else {
      alert('Username not found. Please register first.');
    }

  } catch (err) {
    console.error("Error during face detection:", err);
    alert('Error during face detection. Check the console.');
  }
}



// Register user with basic information
async function registerUser() {
  const username = document.getElementById('registerUsername').value;
  const fullName = document.getElementById('registerFullName').value;
  const password = document.getElementById('registerPassword').value;

  if (!username || !fullName || !password) {
    alert('All fields are required!');
    return;
  }

  const users = await getUsers();
  const existingUser = users.find(user => user.username === username);

  if (existingUser) {
    alert('Username already exists. Please choose a different one.');
    return;
  }

  const newUser = {
    username,
    fullName,
    password,
    faceDescriptor: null
  };

  users.push(newUser);
  await saveUsers(users);

  alert('User registered successfully!');
  window.location.href = 'index.html';
}


// Login user with username and password
async function loginUser() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    alert('Both fields are required!');
    return;
  }

  const users = await getUsers();
  const user = users.find(user => user.username === username && user.password === password);

  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));  // Still use localStorage for session
    window.location.href = 'dashboard.html';
  } else {
    alert('Invalid username or password');
  }
}

