function setSession(user){
  sessionStorage.setItem("tj_user", JSON.stringify(user));
}

document.addEventListener("click", (e) => {

  // LOGIN
  if (e.target?.id === "btnLogin") {

    const username = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      Swal.fire("Error", "Username and password are required", "warning");
      return;
    }

    fetch("http://127.0.0.1:5010/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        username: username,
        password: password
      })
    })
    .then(response => {
      return response.json().then(data => {
        return { ok: response.ok, data: data };
      });
    })
    .then(result => {
      if (!result.ok || result.data.status !== 0) {
        Swal.fire("Login failed", result.data.errorMessage || "Invalid credentials", "error");
        return;
      }

      // ✅ AQUÍ: Guardar sesión del usuario
      sessionStorage.setItem("tj_user", JSON.stringify(result.data.user));

      Swal.fire({
        icon: "success",
        title: "Login successful",
        timer: 1200,
        showConfirmButton: false
      });

      setTimeout(() => {
        window.location.href = "/app";
      }, 1200);
    })
    .catch(error => {
      console.error(error);
      Swal.fire("Error", "Cannot connect to server", "error");
    });
  }

  // REGISTER
  if (e.target?.id === "btnRegister") {

    e.preventDefault();

    // GET VALUES
    const name = document.getElementById("name").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const dateOfBirth = document.getElementById("dateOfBirth").value;
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    // VALIDATION
    if (!name || !lastName || !dateOfBirth || !phone || !email || !password || !confirmPassword) {
      alert("Please complete all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // FETCH (NO ASYNC)
    fetch("http://127.0.0.1:5010/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        lastname: lastName,
        dateOfBirth: dateOfBirth,
        username: email, // change if backend expects email
        password: password,
        phone: phone
      })
    })
    .then(function(response) {

      if (!response.ok) {
        return response.json().then(function(err) {
          throw new Error(err.message || "Registration failed");
        });
      }

      return response.json();
    })
    .then(function(data) {

      alert("Account created successfully!");

      // Redirect after success
      window.location.href = "/login";

    })
    .catch(function(error) {
      console.error("Error:", error);
      alert(error.message);
    });

  }

});